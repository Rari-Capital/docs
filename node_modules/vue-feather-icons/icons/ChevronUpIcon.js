import _mergeJSXProps from "babel-helper-vue-jsx-merge-props";
export default {
  name: 'ChevronUpIcon',
  functional: true,
  render: function render(h, ctx) {
    return h("svg", _mergeJSXProps([{
      attrs: {
        xmlns: "http://www.w3.org/2000/svg",
        width: "24",
        height: "24",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      },
      "class": "feather feather-chevron-up"
    }, ctx.data]), [h("polyline", {
      attrs: {
        points: "18 15 12 9 6 15"
      }
    })]);
  }
};