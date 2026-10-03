import axios from 'axios'
import { message } from 'antd'
import store from '../store'
import { clearUser } from '../store/modules/user'

// 统一的 axios 实例：所有请求都走它，而不是直接用 axios
const request = axios.create({
    baseURL: '/api',      // 之后写 request.post('/login') 就够了
    timeout: 10000,       // 10 秒没响应就中断，避免请求永远挂着
})

//具体步骤
// 组件调用axios -> 请求拦截器 -> HTTP -> server -> 响应拦截器 -> 返回组件


// 请求拦截器   config配置对象{url,method,headers,data,params,...}
request.interceptors.request.use(
    (config) => {
        // 非组件代码读 store 用 store.getState()
        const token = store.getState().user.token

        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }

        return config
    },
    (err) => {
        return Promise.reject(err)
    })

// ── 响应拦截器：统一的错误处理 ──
request.interceptors.response.use(
    (res) => res,   // 直接返回完整的response对象{data,status,headers,config(上一个拦截器返回的),...}，只用解构出data就行

    (err) => {
        // 401跳登录页，500弹提示
        if (err.response) {
            const { status, data, config } = err.response

            // 401 = 登录态失效。
            // 但有个例外：登录接口自己的 401 是"密码错"，不是"登录过期"，
            // 必须放过它，否则用户打错密码页面会被整个踢回登录页
            if (status === 401 && !config.url.includes('/login')) {
                store.dispatch(clearUser())
                message.error('登录已过期，请重新登录')
            }
            if ([502, 503, 504].includes(status)) {
                return Promise.reject(new Error('服务器暂时不可用'))
            }

            //约定服务器返回的data提示是{tip:...}!!!
            return Promise.reject(new Error(data?.tip || `请求失败 (${status})`))
        }

        // 情况二：请求根本没到服务器（后端没启动、断网、代理挂了）
        return Promise.reject(new Error('网络异常，请检查后端是否启动'))
    }
)

export default request