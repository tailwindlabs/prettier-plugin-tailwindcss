// For loading prettier plugins only if they exist
export function loadIfExists(name) {
  try {
    if (require.resolve(name)) {
      return require(name)
    }
  } catch (e) {
    return null
  }
}

// https://lihautan.com/manipulating-ast-with-javascript/
export function visit(ast, callbackMap) {
  function _visit(node, parent, key, index, meta = {}) {
    if (typeof callbackMap === 'function') {
      if (callbackMap(node, parent, key, index, meta) === false) {
        return
      }
    } else if (node.type in callbackMap) {
      if (callbackMap[node.type](node, parent, key, index, meta) === false) {
        return
      }
    }

    const keys = Object.keys(node)
    for (let i = 0; i < keys.length; i++) {
      const child = node[keys[i]]
      if (Array.isArray(child)) {
        for (let j = 0; j < child.length; j++) {
          if (child[j] !== null) {
            _visit(child[j], node, keys[i], j, { ...meta })
          }
        }
      } else if (typeof child?.type === 'string') {
        _visit(child, node, keys[i], i, { ...meta })
      }
    }
  }
  _visit(ast)
}
