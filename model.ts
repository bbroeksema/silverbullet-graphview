export type SpaceGraph = {
  nodes: {
    id: string;
  }[];
  links: {
    source: string;
    target: string;
  }[];
}

export type Tag = {
  key: string,
  page: string,
  value: string
}
