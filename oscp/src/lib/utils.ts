import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Placeholder data source stubs for future integration with NASA/ESA datasets
export const DataSources = {
  // NASA ODPO ORDEM/DAS placeholder: returns scaling factors for debris projections
  async getOdpoScaling(): Promise<{ ordemFactor: number; dasFactor: number }> {
    return { ordemFactor: 1.0, dasFactor: 1.0 };
  },
  // NASA Open Data Portal placeholder
  async fetchLeoDatasetSummary(): Promise<{ name: string; records: number }> {
    return { name: "LEO Objects Snapshot (placeholder)", records: 12345 };
  },
  // ESA Copernicus placeholder
  async fetchSentinelImagerySample(): Promise<{ url: string }> {
    return { url: "https://dataspace.copernicus.eu/" };
  },
};
