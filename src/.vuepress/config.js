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
      { text: "Fuse", link: "/fuse/" },
      { text: "Yield Aggregator", link: "/yag/" },
      {
        text: "Nova",
        items: [
          { text: "Overview", link: "/nova/" },
          {
            text: "Guides",
            items: [
              { text: "Relaying Requests", link: "/nova/guides/relaying/" },
              {
                text: "Developing Strategies",
                link: "/nova/guides/strategies/"
              }
            ]
          }
        ]
      },

      { text: "Deployed Contracts", link: "/contracts/" }
    ],

    sidebarDepth: 10,
    sidebar: "auto",
    smoothScroll: true
  }
};
