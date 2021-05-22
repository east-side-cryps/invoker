import {Parameter} from "./Parameter"

export interface Method {
  name: string;
  parameters: Parameter[];
  returntype: string;
  offset: number;
  safe: boolean;
}
