import { Tag } from "model";
import { index } from "$sb/silverbullet-syscall/mod.ts";
import { readGraphviewSettings } from "utils";

export class ColorMap {
  page: string;
  color: string;

  constructor(page: string, color: string) {
    this.page = page;
    this.color = color;
  }

  // Build a ColorMap object from tags and settings
  static async buildColorMap(): Promise<ColorMap[]> {
    const colorMapSettings = await readGraphviewSettings("colormap");
    const tags: Tag[] = await index.queryPrefix("tag:");
    const taggedPages: string[] = [...new Set(tags.map((tag) => tag.page))];
    const individuallyTaggedPages = await index.queryPrefix("tag:node_color=");
    const default_color = await readGraphviewSettings("default_color");

    const colors: ColorMap[] = taggedPages.map((page) => {
      // if individually defined color
      let color = default_color ? default_color : "000000";
      if (individuallyTaggedPages.find((t) => t.page === page)) {
        color = individuallyTaggedPages.find((t) => t.page === page).value.split("=")[1];
      } else if (colorMapSettings["tag"]) {
        // if page is tagged with a tag from colorMapSettings →  map color code to page name
        // get all tags of page
        const pageTags = tags.filter((tag) => tag.page === page);
        // check, if any of the tags is in colorMapSettings
        const pageTagsInColorMapSettings = pageTags.filter((tag) =>
          colorMapSettings["tag"][tag.value] !== undefined,
        );
        // if yes, use color from colorMapSettings
        if (pageTagsInColorMapSettings.length > 0) {
          color = colorMapSettings["tag"][pageTagsInColorMapSettings[0].value];
        }
      }
      return { "page": page, "color": color };
    });
    return colors;
  }
}