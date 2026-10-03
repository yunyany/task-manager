import { useState, useRef, useEffect } from 'react';
import './study.css'
import { message, Modal } from 'antd';
import { getTime, postTime } from '../../api/study.js'

const _mode = {
    'work': 1,
    'rest': 2,
    'longRest': 3
}
const Study = () => {
    const MIN_SECONDS = 60 //最低学习时间(s)
    const [work, setWork] = useState(25)
    const [rest, setRest] = useState(5)
    const [longRest, setLongRest] = useState(30)
    const [mode, setMode] = useState('work')
    const totalSeconds = (mode === 'work' ? work : (mode === 'rest' ? rest : longRest)) * 60
    const [data, setData] = useState(null)

    // 运行状态
    const [isRunning, setIsRunning] = useState(false)
    const [leftSeconds, setLeftSecond] = useState(work * 60) //剩余时间(s)  //用总时间 - 剩余时间就能获取当前专注时间了
    const [isSuspend, setisSuspend] = useState(false)
    const [finishedMode, setFinishedMode] = useState(null)

    const endTimeRef = useRef(0) //预计结束的绝对时刻

    const audioCtxRef = useRef(null) //铃声

    // 抓学习时长数据
    const loadData = async () => {
        try {
            const res = await getTime()
            setData(res)
        }
        catch (err) {
            message.error(err.message)
        }
    }

    const sendTime = async (focused, isover) => {
        try {
            if (focused >= MIN_SECONDS) {
                await postTime({
                    mode: _mode[mode],
                    seconds: focused,
                    completed: isover
                })
                await loadData()
            }
        }
        catch (err) {
            message.error(err.message)
        }

    }

    const start = () => {
        getAudioCtx()
        if (isRunning) {
            message.warning('已有正在执行的工作，请重置后操作')
            return
        }
        else {
            endTimeRef.current = Date.now() + leftSeconds * 1000
            setIsRunning(true)
            setisSuspend(false)
        }
    }

    const reset = () => {
        sendTime(totalSeconds - leftSeconds, 0)
        setIsRunning(false)
        setLeftSecond(totalSeconds) // 恢复剩余时间
        setisSuspend(false)
    }

    const suspend = () => {
        if (isRunning) {
            const t = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
            setLeftSecond(t)
            setIsRunning(false)
            setisSuspend(true)
        }
    }

    //切换类型
    const trans = (str, val) => {
        if (str === mode) return
        sendTime(totalSeconds - leftSeconds, 0)
        setIsRunning(false)
        setMode(str)
        setLeftSecond(val)
        setisSuspend(false)
    }

    const getAudioCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext()
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()// 恢复音频进程
        }
        return audioCtxRef.current
    }

    const ding = () => {
        const ctx = getAudioCtx()
        const now = ctx.currentTime

            // 两声：0 秒响第一声，0.35 秒响第二声（音更高）
            ;[0, 0.35].forEach((offset, i) => {
                const osc = ctx.createOscillator()    // 音源：产生波形
                const gain = ctx.createGain()          // 音量控制

                osc.connect(gain)
                gain.connect(ctx.destination)          // 接到扬声器

                osc.type = 'sine'                      // 正弦波——最柔和的波形
                osc.frequency.value = i === 0 ? 880 : 1174   // A5 → D6，第二声更高

                // ⭐ 音量包络：瞬间起音，然后快速衰减
                gain.gain.setValueAtTime(0.25, now + offset)
                gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3)

                osc.start(now + offset)
                osc.stop(now + offset + 0.3)
            })
    }

    useEffect(() => {
        if (!isRunning) return

        const id = setInterval(() => {
            const t = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
            setLeftSecond(t)
            if (t === 0) {
                sendTime(totalSeconds - t, 1)
                setIsRunning(false)
                setLeftSecond(totalSeconds)
                setFinishedMode(mode)
                ding()
            }
        }, 1000);

        return () => {
            clearInterval(id)
        }
    }, [isRunning])
    useEffect(() => {loadData()}, [])
    useEffect(() => {
        return () => {
            audioCtxRef.current?.close()
            audioCtxRef.current = null
        }
    }, [])

    const usingNotice = async () => {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
        message.success('已开启通知')
    } else {
        message.warning('你拒绝了通知权限,请在网站权限里打开通知')
    }
}

    // 计算+整形
    const mm = String(Math.floor(leftSeconds / 60)).padStart(2, '0')
    const ss = String((leftSeconds % 60).toFixed(0)).padStart(2, '0')

    return (
        <div className='study-container'>
            <div style={{
                width: '100%',
                fontSize: '24px',
                fontWeight: '500',
                textAlign: 'center'
            }}>
                <span>{"番茄钟(pomodoro)"}</span>
                <span style={{
                    color: 'red',
                    cursor: 'pointer',
                    marginLeft: '10px'
                }}
                    onClick={() => Modal.info({
                        content: '低于1分钟将不计入总学习时长',
                        centered: true
                    })}
                >tip*</span>
            </div>
            <div className='study-pomodoro'>
                {/* 顶部栏：设置 + 时长选项 + 最大化 */}
                <div className='pomodoro-top'>
                    <span className='study-setting'>设置</span>
                    <ul className='study-setting-list'>
                        <li onClick={() => trans('work', work * 60)} className={mode === 'work' ? 'study-select' : ''}>番茄工作法</li>
                        <li onClick={() => trans('rest', rest * 60)} className={mode === 'rest' ? 'study-select' : ''}>短暂休息</li>
                        <li onClick={() => trans('longRest', longRest * 60)} className={mode === 'longRest' ? 'study-select' : ''}>长时间休息</li>
                    </ul>
                    <span className='study-expand'>最大化</span>
                </div>

                {/* 中间倒计时 */}
                <div className='pomodoro-clock'>
                    <span>{mm}</span>
                    <i>:</i>
                    <span>{ss}</span>
                </div>

                {/* 开始 / 重置 */}
                <div className='pomodoro-btns'>
                    <button
                        className='study-start'
                        onClick={() => start()}
                    >{isSuspend ? '继续' : "开始"}</button>
                    <button
                        className={`study-suspend ${isRunning ? '' : 'cannot-suspend'}`}
                        onClick={() => suspend()}
                    >
                        暂停
                    </button>
                    <button
                        className='study-reset'
                        onClick={() => reset()}
                    >重置</button>

                </div>

                {/* 启用通知 */}
                <button 
                onClick={()=>usingNotice()}
                className='study-notice'
                >启用通知</button>
            </div>
            <Modal
                open={!!finishedMode}
                onCancel={() => setFinishedMode(null)}
                footer={null}
                centered
                title={finishedMode === 'work' ? '番茄工作法完成 🍅' : '休息结束'}
            >
                <p style={{ lineHeight: 1.8, marginBottom: 20 }}>
                    {finishedMode === 'work'
                        ? '辛苦了！想休息就点「短暂休息」，想接着学就点「开始」。'
                        : '休息好了，点「开始」进入下一个番茄钟吧。'}
                </p>
                <button
                    type='button'
                    onClick={() => setFinishedMode(null)}
                    style={{ display: 'block', margin: '0 auto', padding: '8px 32px' }}
                >
                    知道了
                </button>
            </Modal>
            <div className='accomplish-study'>
                <div className='accomplish-tomato'>
                    <span>已完成的番茄:</span>
                    <span>{data === null ? "加载中..." : data.over}</span>
                </div>
                <div 
                className='study-sumTime'
                onClick={()=>{
                    if(data === null)return
    
                    return Modal.success({
                        centered:true,
                        title:`${data.sumTime}秒等于`,
                        content:<div>
                            <span>{(data.sumTime/60).toFixed(2)}分钟</span>
                            <br/>
                            <span>{(data.sumTime/3600).toFixed(2)}小时</span>
                        </div>
                    })
                }}
                >
                    <span>学习总时长:</span>
                    <span>{data === null ? "加载中..." : data.sumTime}</span>
                    <i>{" 秒 "}</i>
                </div>
            </div>
        </div>
    )
}

export default Study;