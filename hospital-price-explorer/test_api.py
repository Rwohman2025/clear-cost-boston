
"""Integration checks against a temporary DB built from the real source workbook."""
import importlib
import runpy
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

import config

ROOT = Path(__file__).resolve().parent


class ThreeHospitalApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.previous_db = config.DB
        config.DB = str(Path(cls.temp.name) / "prices.duckdb")
        loader = runpy.run_path(str(ROOT / "pipeline" / "02_load_xlsx.py"))
        loader["load"]()
        runpy.run_path(str(ROOT / "pipeline" / "03_clean.py"))
        cls.api = importlib.import_module("server")
        cls.api.DB = config.DB
        cls.api.load.cache_clear()
        cls.client = TestClient(cls.api.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.api.load.cache_clear()
        config.DB = cls.previous_db
        cls.temp.cleanup()

    def test_health_and_hospital_scope(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        health = response.json()
        self.assertEqual(health["source"], "three_hospitals_25_procedures.xlsx")
        self.assertEqual((health["hospitals"], health["procedures"], health["rows"]), (3, 25, 582))
        hospitals = self.client.get("/api/hospitals").json()
        self.assertEqual({h["id"] for h in hospitals}, {"bidmc", "mgh", "bwh"})
        self.assertTrue(all(h["beds"] is None for h in hospitals))

    def test_prices_match_spreadsheet(self):
        # Independent source calculation for MGH colonoscopy / BCBS outpatient rates.
        sheet = pd.read_excel(config.XLSX, sheet_name="Mass General", header=4, dtype={"CPT code": str})
        selected = sheet[
            (sheet["CPT code"] == "45385")
            & sheet["Payer"].fillna("").str.contains("BLUE CROSS|BCBS", case=False, regex=True)
            & sheet["Setting"].isin(["outpatient", "both"])
        ]
        expected = float(np.median(pd.to_numeric(selected["Negotiated USD"], errors="coerce").dropna()))
        response = self.client.get("/api/prices/compare", params={
            "code": "45385", "priceType": "negotiated", "setting": "outpatient",
            "payerId": "blue-cross-blue-shield", "hospitalIds": "mgh",
        })
        self.assertEqual(response.status_code, 200)
        rows = response.json()["rows"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["hospital"]["id"], "mgh")
        self.assertAlmostEqual(rows[0]["amount"], expected)

    def test_missing_prices_are_not_filled(self):
        response = self.client.get("/api/prices/compare", params={
            "code": "19301", "priceType": "cash", "setting": "outpatient", "hospitalIds": "bwh",
        })
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["rows"], [])
        self.assertIsNone(result["stats"])
        self.assertEqual([h["id"] for h in result["missingHospitals"]], ["bwh"])

    def test_supporting_endpoints(self):
        self.assertEqual(len(self.client.get("/api/procedures").json()), 25)
        self.assertTrue(self.client.get("/api/payers").json())
        self.assertEqual(len(self.client.get("/api/quality").json()), 3)
        for hid in ("bidmc", "mgh", "bwh"):
            response = self.client.get(f"/api/hospitals/{hid}/prices")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json()), 25)
        self.assertEqual(self.client.get("/api/procedures/invalid").status_code, 404)

    def test_admin_csv_upload_adds_a_hospital(self):
        import os
        previous_key = os.environ.get("ADMIN_API_KEY")
        previous_username = os.environ.get("ADMIN_USERNAME")
        os.environ["ADMIN_API_KEY"] = "test-admin-key"
        os.environ["ADMIN_USERNAME"] = "test-admin"
        csv = b"code,description,payer,setting,gross,cash,negotiated\n45385,Colonoscopy,Blue Cross Blue Shield,outpatient,2500,900,1100\n"
        response = self.client.post("/api/admin/uploads", headers={"X-Admin-Username": "test-admin", "X-Admin-Key": "test-admin-key"}, data={
            "hospital_name": "Test Hospital", "hospital_code": "TEST", "published": "2026-10-24",
        }, files={"file": ("test.csv", csv, "text/csv")})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["inScopeRows"], 1)
        hospitals = self.client.get("/api/hospitals").json()
        self.assertIn("test", {h["id"] for h in hospitals})
        price = self.client.get("/api/prices/compare", params={
            "code": "45385", "priceType": "cash", "setting": "outpatient", "hospitalIds": "test",
        }).json()
        self.assertEqual(price["rows"][0]["amount"], 900.0)
        con = __import__("duckdb").connect(config.DB)
        con.execute("delete from raw where hospital = 'TEST'")
        con.execute("delete from hospital_registry where id = 'test'")
        con.close()
        runpy.run_path(str(ROOT / "pipeline" / "03_clean.py"))
        self.api.load.cache_clear()
        self.api.refresh_hospitals()
        if previous_key is None:
            del os.environ["ADMIN_API_KEY"]
        else:
            os.environ["ADMIN_API_KEY"] = previous_key
        if previous_username is None:
            del os.environ["ADMIN_USERNAME"]
        else:
            os.environ["ADMIN_USERNAME"] = previous_username


if __name__ == "__main__":
    unittest.main()
