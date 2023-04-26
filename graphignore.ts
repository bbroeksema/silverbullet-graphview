import { editor, space, index } from "$sb/silverbullet-syscall/mod.ts";

export class GraphIgnore {
  ignoredPages: string[]

  constructor(ignoredPages: string[] = []) {
    this.ignoredPages = ignoredPages;
  }

  // Get all pages tagged with .graphignore
  async init(): Promise<void> {
    this.ignoredPages = (await index.queryPrefix("tag:.graphignore"))
      .map((tag) => tag.page)
  }

  // Check if a page is tagged with .graphignore
  isIgnoredPage(page: string): boolean {
    return this.ignoredPages.includes(page);
  }

  // Filter function to remove pages tagged with .graphignore
  pagefilter = (page) => !this.isIgnoredPage(page.name);

  // Filter function to remove links to and from pages tagged with .graphignore
  linkfilter = (link) => {
    const topage = link.key.split(':')
      .slice(1, -1)
      .join(':')
    return !this.isIgnoredPage(link.page)
      && !this.isIgnoredPage(topage)
  }
}