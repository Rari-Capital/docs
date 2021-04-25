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
    editLinks: true,
    editLinkText: "Edit this page on GitHub",
    nav: [
      { text: "Home", link: "/" },
      { text: "Yield Aggregator", link: "/yag/" },
      { text: "Fuse", link: "/fuse/" }
    ],
    sidebarDepth: 3,
    sidebar: {
      // '/': [
      //   ''
      // ],
      "/yag/": [
        ""
        // 'front-matter',qq
        // 'palette'
      ],
      "/fuse/": [""]
    },
    smoothScroll: true
  },

  plugins: ["@vuepress/plugin-back-to-top", "@vuepress/plugin-medium-zoom"]
};
