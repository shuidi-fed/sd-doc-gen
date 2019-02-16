// 导入 parser 函数
const parser = require('@vuese/parser').parser
const Render = require('@vuese/markdown-render')
const fs = require('fs')
const path = require('path')
const process = require('process')

// 执行路径
const dir = process.cwd()

// 执行文件夹名
const root = 'src'

// 初始src地址
const startSrcPath = path.join(dir, root)
// 初始doc地址
const startDocsPath = path.join(dir, 'docs')

const projectTree = {}

// 用于生成侧栏
// [{
//   ...
//   children:[{
//     ...
//     children:[]
//   }]
// }]
const docTree = []
// 获取src对应的docs地址
function matchDocPath(path) {
  return path.replace(startSrcPath, startDocsPath)
}

function mkdirSafely(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path)
  }
}

const readerQueue = []

const vueReader = {
  condition: dir => dir.endsWith('vue'),
  read: (dir) => {
    const source = fs.readFileSync(dir, 'utf-8')
    // 使用 parser 函数解析并得到结果
    try {
      const parserRes = parser(source)
      // 创建渲染实例
      const r = new Render(parserRes)
      // 基本渲染，返回值是一个对象
      // const renderRes = r.render()
      // 渲染完整的 markdown 文本，返回值是 markdown 字符串
      const markdownRes = r.renderMarkdown()
      if (!markdownRes) return
      fs.writeFileSync(matchDocPath(dir).replace(/\..+$/, '.md').replace(/\/index(?=\.)/, '/README'), markdownRes.content, 'utf-8')
    } catch (e) {
      console.error(e)
    }
  }
}

readerQueue.push(vueReader)

function enter(dir, parentObj) {
  fs.readdirSync(dir).forEach(file => {
    const fileDir = path.join(dir, file)
    const stat = fs.statSync(fileDir)
    if (file.includes('.DS_Store') || (stat.isFile() && !['.vue', '.js'].some(val => file.endsWith(val)))) return
    if (stat.isDirectory()) {
      mkdirSafely(matchDocPath(fileDir))
      parentObj[file] = {}
      enter(fileDir, parentObj[file])
    } else if (stat.isFile()) {
      readerQueue.forEach((reader) => {
        if (reader.condition(fileDir)) {
          reader.read(fileDir)
        }
      })
      parentObj[file] = ''
    }
  })
}

// 解析生成的docs文件结构
function enterDocs(dir, children) {
  fs.readdirSync(dir).forEach(file => {
    const fileDir = path.join(dir, file)
    const stat = fs.statSync(fileDir)
    if (file.includes('.vuepress') || file.includes('.DS_Store') || (stat.isFile() && !['.md'].some(val => file.endsWith(val)))) return
    if (stat.isDirectory()) {
      const fileObj = {
        title: file,
        children: []
      }
      children.push(fileObj)
      enterDocs(fileDir, fileObj.children)
    } else if (stat.isFile()) {
      children.push(fileDir.replace(startDocsPath, '').replace('README.md', ''))
    }
  })
}

// 去除docTree空节点
function cleanDocTree() {
  let count = 0
  do {
    // 每次去除空叶子节点
    count = 0
    docTreeFilter(docTree)
    console.log(count)
  } while (count !== 0)

  function docTreeFilter(docArr) {
    for (let i = 0; i < docArr.length; i++) {
      if (!docArr[i].children) {
        continue
      }
      if (docArr[i].children.length === 0) {
        // delete docArr[i]
        console.log(docArr.splice(i, 1))
        count++
      } else {
        docTreeFilter(docArr[i].children)
      }
    }
  }
}

function main() {
  mkdirSafely(path.join(dir, 'docs'))
  mkdirSafely(path.join(dir, 'docs', '.vuepress'))
  // 颜色配置
  mkdirSafely(path.join(dir, 'docs', '.vuepress', 'styles'))
  fs.writeFileSync(path.join(dir, 'docs', '.vuepress', 'styles', 'palette.styl'), '$accentColor = #24bdfe', 'utf-8')
  // 读取src，生成docs文件夹
  enter(startSrcPath, projectTree)

  // 生成入口(读取项目的readme)
  if (fs.existsSync(path.join(dir, 'README.md'))) {
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf-8')
    fs.writeFileSync(path.join(startDocsPath, 'README.md'), readme, 'utf-8')
  }
  // 读取生成md之后的docs文件夹
  enterDocs(startDocsPath, docTree)
  // 清除docs空节点
  cleanDocTree()
  // 拼接config.js
  const CONFIGJS = `
  module.exports = {
    title: 'sea',
    themeConfig: {
      sidebar: ${JSON.stringify(docTree)}
    }
  }`
  // 写config.js
  fs.writeFileSync(path.join(startDocsPath, '.vuepress', 'config.js'), CONFIGJS, 'utf-8')
}

module.exports = main
