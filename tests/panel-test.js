const assert = require("assert")
const fs = require("fs")
const path = require("path")

const panel = fs.readFileSync(path.join(__dirname, "../Panel.qml"), "utf8")

function textBlocks(source) {
  const blocks = []
  const opener = /\bText\s*\{/g
  let match
  while ((match = opener.exec(source)) !== null) {
    let depth = 1
    let i = opener.lastIndex
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++
      else if (source[i] === "}") depth--
      i++
    }
    blocks.push(source.substring(opener.lastIndex, i - 1))
  }
  return blocks
}

const remoteSinks = textBlocks(panel).filter((block) => /text:\s*modelData\.(name|symbol)\b/.test(block))

assert.strictEqual(remoteSinks.length, 4)
remoteSinks.forEach((block) => {
  assert.ok(/textFormat:\s*Text\.PlainText\b/.test(block), "coin name/symbol Text must declare PlainText:\n" + block)
})
