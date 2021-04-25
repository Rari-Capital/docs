const { description } = require("../../package");

module.exports = {
  title: "Rari Capital",
  description: description,

  head: [
    ["meta", { name: "theme-color", content: "#42C346" }],
    ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
    [
      "meta",
      { name: "apple-mobile-web-app-status-bar-style", content: "black" }
    ]
  ],

  themeConfig: {
    repo: "Rari-Capital/docs",
    docsDir: "/",
    nav: [
      { text: "Home", link: "/" },
      { text: "Yield Aggregator", link: "/yag/" },
      { text: "Fuse", link: "/fuse/" },
      { text: "Deployed Contracts", link: "/contracts/" }
    ],
    sidebarDepth: 3,
    sidebar: {
      "/yag/": [""],
      "/fuse/": [""],
      "/contracts/": [""]
    },
    smoothScroll: true
  }
};
