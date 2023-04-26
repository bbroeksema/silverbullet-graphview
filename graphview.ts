import { editor, space, index } from "$sb/silverbullet-syscall/mod.ts";
import { asset } from "$sb/plugos-syscall/mod.ts";
import { readSetting } from "$sb/lib/settings_page.ts";
import { StateProvider } from "stateProvider";
import { SpaceGraph, Tag, ColorMap } from "model";

const stateProvider = new StateProvider("showGraphView");

// Toggle Graph View and sync state
export async function toggleGraphView() {
  await stateProvider.toggleGraphViewStatus();
  if (await stateProvider.getGraphViewStatus()) {
    const name = await editor.getCurrentPage();
    await renderGraph(name);
  } else {
    await editor.hidePanel("lhs");
  }
}

// if something changes, redraw
export async function updateGraphView() {
  const name = await editor.getCurrentPage();
  await renderGraph(name);
}

// render function into the LHS-Panel
async function renderGraph(page: any) {
  // https://github.com/d3/d3-force
  const graph = await buildGraph(page);
  const graph_json = JSON.stringify(graph);
  const css = await asset.readAsset("style.css");
  if (await stateProvider.getGraphViewStatus()) {
    await editor.showPanel(
      "lhs",
      1, // panel flex property
      `<html>
        <head>
          <style>${css}</style>
        </head>
        <body>
          <div id="graph" >
          </div>
        </body>
      </html>`,
      await script(graph_json), // Script (java script as string)
    );
  }
}

// Embed script
async function script(graph: any) {
  const d3js = await asset.readAsset("asset/d3.js", "utf8");
  const d3forcejs = await asset.readAsset("asset/d3-force.js", "utf8");
  const d3forcegraph = await asset.readAsset(
    "asset/force-graph.js",
    "utf8",
  );

  return `
    ${d3js}
    ${d3forcejs}
    ${d3forcegraph}
    
    const graph = ${graph};
    console.log(graph);
    const graph_div = document.querySelector('#graph');
    
    let chart;
    function createChart() {
      // Remove the existing chart object from the DOM
      graph_div.innerHTML = '';
    
      // Create a new chart object with the updated dimensions
      chart = ForceGraph(graph, {
        nodeId: d => d.id,
        nodeTitle: d => d.id,
        nodeStrokeOpacity: 0.75,
        height: window.innerHeight,
        width: window.innerWidth,
      });
    
      // Add the new chart object to the DOM
      graph_div.appendChild(chart);
    }
    
    createChart();

    function handleResize() {
      // Check if the dimensions have actually changed
      if (window.innerHeight-10 !== chart.height || window.innerWidth-10 !== chart.width) {
        // Recreate/redraw the chart object
        createChart();
      }
    }
        
    let timeout = false;
    // Add an event listener to the window object that listens for the resize event
    window.addEventListener('resize', () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleResize, 250);
    });
  `;
}

async function readGraphviewSettings(key: string) {
  const graphviewSettings = await readSetting("graphview", {});
  if (graphviewSettings[key] !== undefined) {
    return graphviewSettings[key];
  }
  return false;
}

// Build a ColorMap object from tags and settings
async function buildColorMap(): Promise<ColorMap[]> {
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
    } else if (colorMapSettings) {
      // if page is tagged with a tag from colorMapSettings →  map color code to page name
      // get all tags of page
      const pageTags = tags.filter((tag) => tag.page === page);
      // check, if any of the tags is in colorMapSettings
      const pageTagsInColorMapSettings = pageTags.filter((tag) =>
        colorMapSettings[tag.value] !== undefined,
      );
      // if yes, use color from colorMapSettings
      if (pageTagsInColorMapSettings.length > 0) {
        color = colorMapSettings[pageTagsInColorMapSettings[0].value];
      }
    }
    return { "page": page, "color": color };
  });
  return colors;
}

// Build a SpaceGraph object from the current space
async function buildGraph(name: string): Promise<SpaceGraph> {
  // Get pages tagged with .graphignore
  const ignorePages: string[] = (await index.queryPrefix("tag:.graphignore"))
    .map((tag) => tag.page);

  // Get all pages in space
  const pages = await space.listPages();
  const nodeNames = pages
    .filter((page) => !ignorePages.includes(page.name))
    .map(({ name }) => {
      return name;
    });

  // Filter function to remove links to and from pages tagged with .graphignore
  const filterIgnoredLinks = (link) => {
    const topage = link.key.split(':')
      .slice(1, -1)
      .join(':')
    return !ignorePages.includes(link.page)
      && !ignorePages.includes(topage)
  }

  // NOTE: This may result to the same link showing multiple times
  //       if the same page has multiple references to another page.
  const pageLinks = await index.queryPrefix(`pl:`);
  const links = pageLinks
    .filter(filterIgnoredLinks)
    .map(({ key, page }) => {
      const to = key.split(':')
        .slice(1, -1)
        .join(':'); // Key: pl:page:pos

      if (!nodeNames.includes(to)) {
        // Add nodes for non-existing pages which are linked to
        nodeNames.push(to);
      }
      return { "source": page, "target": to };
    });

  const colors: ColorMap[] = await buildColorMap()

  const default_color = await readGraphviewSettings("default_color");

  const nodes = nodeNames.map((name) => {
    // if page in colors → map color code to page name
    let color = default_color ? default_color : "000000";
    if (colors.find((c) => c.page === name)) {
      color = colors.find((c) => c.page === name).color;
    }
    return { "id": name, "color": color };
  });

  return { "nodes": nodes, "links": links };
}

// use internal navigation via syscall to prevent reloading the full page.
// From https://github.com/Willyfrog/silverbullet-backlinks
export async function navigateTo(pageRef: string) {
  if (pageRef.length === 0) {
    console.log("no page name supplied, ignoring navigation");
    return;
  }
  const [page, pos] = pageRef.split("@");
  console.log(`navigating to ${pageRef}`);
  await editor.navigate(page, +pos); // todo: do we have the position for it?
}
