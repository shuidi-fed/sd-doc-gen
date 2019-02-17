// 导入 parser 函数
const parser = require('@vuese/parser').parser
const Render = require('@vuese/markdown-render').default
const fs = require('fs')
const path = require('path')

console.log(parser,Render);

// 执行文件夹名
const src = 'src'

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


function main(root) {
  // 初始src地址
  const srcPath = path.join(root, src)
  // 初始doc地址
  const docsPath = path.join(root, 'docs')

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

  const readerQueue = [vueReader]

  // 获取src对应的docs地址
  function matchDocPath(path) {
    return path.replace(srcPath, docsPath)
  }
  // 安全mkdir
  function mkdirSafely(path) {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path)
    }
  }
  // 解析src文件结构
  function enterSrc(dir, parentObj) {
    fs.readdirSync(dir).forEach(file => {
      const fileDir = path.join(dir, file)
      const stat = fs.statSync(fileDir)
      if (file.includes('.DS_Store') || (stat.isFile() && !['.vue', '.js'].some(val => file.endsWith(val)))) return
      if (stat.isDirectory()) {
        mkdirSafely(matchDocPath(fileDir))
        parentObj[file] = {}
        enterSrc(fileDir, parentObj[file])
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
        children.push(fileDir.replace(docsPath, '').replace('README.md', ''))
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
    } while (count !== 0)

    function docTreeFilter(docArr) {
      for (let i = 0; i < docArr.length; i++) {
        if (!docArr[i].children) {
          continue
        }
        if (docArr[i].children.length === 0) {
          // delete docArr[i]
          docArr.splice(i, 1)
          count++
        } else {
          docTreeFilter(docArr[i].children)
        }
      }
    }
  }

  mkdirSafely(path.join(root, 'docs'))
  mkdirSafely(path.join(root, 'docs', '.vuepress'))
  // 颜色配置
  mkdirSafely(path.join(root, 'docs', '.vuepress', 'styles'))
  fs.writeFileSync(path.join(root, 'docs', '.vuepress', 'styles', 'palette.styl'), '$accentColor = #24bdfe', 'utf-8')
  // 读取src，生成docs文件夹
  enterSrc(srcPath, projectTree)

  // 生成入口(读取项目的readme)
  if (fs.existsSync(path.join(root, 'README.md'))) {
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf-8')
    fs.writeFileSync(path.join(docsPath, 'README.md'), readme, 'utf-8')
  }
  // 读取生成md之后的docs文件夹
  enterDocs(docsPath, docTree)
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
  fs.writeFileSync(path.join(docsPath, '.vuepress', 'config.js'), CONFIGJS, 'utf-8')
}
module.exports = main