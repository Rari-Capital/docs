module.exports = {
  title: '@rari-capital/docs',
  description: 'Documentation for the Rari Protocol',
  themeConfig: {
    repo: 'Rari-Capital/docs',
    docsDir: 'docs',
    editLinks: true,
    editLinkText: 'Edit this page on GitHub',
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Yield Aggregator', link: '/yag/' },
      { text: 'Fuse', link: '/fuse/' },
    ],
    sidebarDepth: 3,
    sidebar: {
      // '/': [
      //   ''
      // ],
      '/yag/': [
        '',
        // 'front-matter',qq  
        // 'palette'
      ],
      '/fuse/': [
        '',
      ],
    },
    smoothScroll: true,
  },
}

