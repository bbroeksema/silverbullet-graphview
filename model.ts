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

export type ColorMap = {
  page: string,
  color: string
}