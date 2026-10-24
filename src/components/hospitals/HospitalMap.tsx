import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { Hospital } from "@/lib/models/types";

const ZOOM = 13;
const CENTER = { latitude: 42.347, longitude: -71.083 };
const TILE_SIZE = 256;
const GRID = 3;

function worldPoint(latitude: number, longitude: number) {
  const scale = 2 ** ZOOM * TILE_SIZE;
  const x = ((longitude + 180) / 360) * scale;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale;
  return { x, y };
}

const center = worldPoint(CENTER.latitude, CENTER.longitude);
const firstTileX = Math.floor(center.x / TILE_SIZE) - 1;
const firstTileY = Math.floor(center.y / TILE_SIZE) - 1;
const mapWidth = GRID * TILE_SIZE;

function mapPosition(latitude: number, longitude: number) {
  const point = worldPoint(latitude, longitude);
  return {
    left: ((point.x - firstTileX * TILE_SIZE) / mapWidth) * 100,
    top: ((point.y - firstTileY * TILE_SIZE) / mapWidth) * 100,
  };
}

export function HospitalMap({ hospitals }: { hospitals: Hospital[] }) {
  const located = hospitals.filter((hospital) => hospital.latitude != null && hospital.longitude != null);
  const unlocated = hospitals.filter((hospital) => hospital.latitude == null || hospital.longitude == null);

  if (!located.length) return null;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Hospital map</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pins use each hospital’s saved street address.</p>
        </div>
        <span className="text-xs text-muted-foreground">© OpenStreetMap contributors</span>
      </div>
      <div className="relative aspect-[3/2] overflow-hidden bg-muted" aria-label="Map of hospitals with published pricing data">
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden="true">
          {Array.from({ length: GRID * GRID }, (_, index) => {
            const x = firstTileX + (index % GRID);
            const y = firstTileY + Math.floor(index / GRID);
            return <img key={`${x}-${y}`} src={`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`} alt="" className="h-full w-full" />;
          })}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-primary/[0.03]" />
        {located.map((hospital, index) => {
          const position = mapPosition(hospital.latitude!, hospital.longitude!);
          const offset = ((index % 3) - 1) * 1.2;
          return (
            <Link
              key={hospital.id}
              to="/hospitals/$hospitalId"
              params={{ hospitalId: hospital.id }}
              title={`${hospital.name} — ${hospital.address}`}
              className="group absolute z-10 -translate-x-1/2 -translate-y-full"
              style={{ left: `${position.left + offset}%`, top: `${position.top + offset}%` }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max max-w-48 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-center text-xs text-background shadow group-hover:block">
                {hospital.name}
              </span>
            </Link>
          );
        })}
      </div>
      {unlocated.length > 0 && <p className="border-t px-5 py-3 text-xs text-muted-foreground">{unlocated.length} hospital{unlocated.length === 1 ? "" : "s"} will appear here once a street address is added during upload.</p>}
    </section>
  );
}
