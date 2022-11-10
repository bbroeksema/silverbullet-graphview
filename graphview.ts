import {
  clientStore,
  editor,
  index,
  space,
} from "$sb/silverbullet-syscall/mod.ts";
import { asset } from "$sb/plugos-syscall/mod.ts";

const GraphViewKey = "showGraphView";

export async function toggleGraphView() {
  const showingGraphView = (await getGraphViewStatus());
  await clientStore.set(GraphViewKey, !showingGraphView);
  if (!showingGraphView) {
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

// Use store to figure out if backlinks are open or closed.
async function getGraphViewStatus(): Promise<boolean> {
  return !!(await clientStore.get(GraphViewKey));
}

async function script(graph: any) {
  const d3js = await asset.readAsset("asset/d3.js", "utf8");
  const d3forcejs = await asset.readAsset("asset/d3-force.js", "utf8");
  const d3forcegraph = await asset.readAsset(
    "asset/force-graph.js",
    "utf8",
  );
  // TODO: Get current height and width
  
  return `
    ${d3js}
    ${d3forcejs}
    ${d3forcegraph}
    
    const graph = ${graph};
    console.log(graph);
    const chart = ForceGraph(graph, {
      nodeId: d => d.id,
      nodeTitle: d => d.id,
      nodeStrokeOpacity: 0.75,
      height: 600,
      width: 700,
    });
    const graph_div = document.querySelector('#graph');
    graph_div.appendChild(chart);
  `;
}

// render function into the LHS
async function renderGraph(page: any) {
  // https://github.com/d3/d3-force
  const graph = await buildGraph(page);
  const graph_json = JSON.stringify(graph);
  if (await getGraphViewStatus()) {
    await editor.showPanel(
      "lhs",
      1,
      `<html>
        <head>
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

async function buildGraph(name: string) {
  const pages = await space.listPages();
  const nodeNames = pages.map(({ name }) => {
    return name;
  });

  // NOTE: This may result to the same link showing multiple times
  //       if the same page has multiple references to another page.
  const pageLinks = await index.queryPrefix(`pl:`);
  const links = pageLinks.map(({ key, page }) => {
    const [, to] = key.split(":"); // Key: pl:page:pos

    if (!nodeNames.includes(to)) {
      // Add nodes for non-existing pages which are linked to
      nodeNames.push(to);
    }
    return { "source": page, "target": to };
  });

  const nodes = nodeNames.map((name) => {
    return { "id": name };
  });

  return { "nodes": nodes, "links": links };
}
