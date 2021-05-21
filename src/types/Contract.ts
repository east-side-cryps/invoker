import {Manifest} from "./Manifest"

export interface Contract {
  hash: string;
  manifest: Manifest;
  block: number;
  time: string;
  asset_name: string;
  symbol: string;
  type: string;
}
