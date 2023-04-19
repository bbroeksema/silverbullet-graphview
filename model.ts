export type SpaceGraph = {
  nodes: {
    id: string;
  }[];
  links: {
    source: string;
    target: string;
  }[];
}