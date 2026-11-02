const React = require('react')

function SvgMock(props) {
  return React.createElement('svg-mock', props, props.children)
}

module.exports = SvgMock
module.exports.default = SvgMock
