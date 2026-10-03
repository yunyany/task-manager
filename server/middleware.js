import jwt from 'jsonwebtoken'
import express from 'express'
import pool from './db.js'
const app = express()

/**
 * 认证中间件：检查请求头里的 token 有没有效
 *
 * 【什么是 Express 中间件】
 * 签名固定是 (req, res, next) 的函数。用法：
 *     app.get('/api/me', auth, 处理函数)
 * 请求会先流经 auth，只有 auth 放行了，才轮到后面的处理函数。
 * 所以中间件就是"关卡"，可以串很多个：app.get(路径, 关卡1, 关卡2, 处理函数)
 */
const auth = (req, res, next) => {
    // 约定的传法：前端把 token 放在请求头里，格式是 HTTP 标准
    //     Authorization: Bearer eyJhbGciOi...
    // 注意 'Bearer ' 结尾有一个空格，总共 7 个字符，slice(7) 就是把前缀切掉取 token 本体
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''

    // 情况一：压根没带 token —— 就是没登录
    // 这里必须 return，否则代码会继续往下走到 verify，白白抛一次异常
    if (!token) {
        return res.status(401).json({ tip: '未登录' })
    }

    try {
        // jwt.verify 一次性做两件事：
        //   1. 验签名 —— 用 JWT_SECRET 重新算一遍签名，对不上说明 token 被伪造或篡改过
        //   2. 验过期 —— token 里的 exp 时间过了也会抛错
        // 两者任意一项不通过都会抛异常，所以必须用 try 包起来
        const payload = jwt.verify(token, process.env.JWT_SECRET)

        // 把解析出来的用户信息挂到 req 上。
        // 这样后面每一个处理函数都能直接用 req.user.id，不用各自再解析一遍 token。
        // 这是 Express 中间件之间"往下传数据"的标准做法（req 就是接力棒）
        req.user = payload

        // next() 的意思是"我这关过了，交给下一个环节"。
        // 规律：放行时调 next()，拦下时直接 res.json() 结束、绝对不要调 next()
        next()
    } catch (err) {
        // 情况二：token 被篡改 / 已过期 / 格式不对
        // 统一返回 401，前端看到 401 就知道该把用户请回登录页了。
        // 不给用户看具体是哪种错（防止有人靠错误信息试探）
        return res.status(401).json({ tip: '登录已过期，请重新登录' })
    }
}


export default auth
export const exprieOverdueTasks = async (userid)=>{
    await pool.query(
        'update tasks set status = 2 where status = 0 and user_id = ? and due_date is not null and due_date < now()',
        [userid]
    )
}
