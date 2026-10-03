import './publish.css'
import { postTasks } from '../../api/tasks';
import { DatePicker, message, Modal } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

const picker = [
    "", "YYYY-MM-DD", "MM-DD HH", "DD HH:mm"
]

const Publish = () => {
    const [selectTime, setSelect] = useState(2)
    const [endTime, setEndTime] = useState(null)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [priority, setPriority] = useState(2)
    const [isSubmit, setIsSubmit] = useState(false)

    const getResult = () => {
        //后端解构赋值，前端传的变量要对应！
        return {
            title,
            description: content,
            priority,
            due_date: endTime ? endTime.format('YYYY-MM-DD HH:mm:ss') : null
        }
    }
    //重置
    const reset = () => {
        setContent('')
        setEndTime(null)
        setTitle('')
        setSelect(2)
        setPriority(2)
    }

    const submitTask = async (e) => {
        e.preventDefault();
        setIsSubmit(true)
        //前端初次校验
        if (!title) {
            message.warning('请填写任务标题')
            setIsSubmit(false)
            return;
        }
        else if (!content) {
            message.warning('请填写任务内容')
            setIsSubmit(false)
            return;
        }

        try {
            const payload = getResult();
            await postTasks(payload)
            message.open({
                type: 'success',
                content: '提交成功',
                duration: 2
            })
            reset()
        }
        catch (err) {
            message.open({
                type: 'error',
                content: '提交失败: ' + err.message,
                duration: 2
            })
        }
        setIsSubmit(false)
    }

    return (
        <div className='publish-container'>
            <div className='publish-tasks'>添加任务</div>

            <form className='publish-form' onSubmit={(e) => submitTask(e)}>
                <div className='select-time'>
                    <span>年度</span>
                    <input name='time' type='radio' checked={selectTime === 1} onChange={() => setSelect(1)} />
                    <span>月度</span>
                    <input name='time' type='radio' checked={selectTime === 2} onChange={() => setSelect(2)} />
                    <span>每日</span>
                    <input name='time' type='radio' checked={selectTime === 3} onChange={() => setSelect(3)} />
                    <button type='button' className='tip' style={{
                        color: "red",
                        backgroundColor: "white",
                        border: 'none'
                    }}
                        onClick={() =>
                            Modal.warning({
                                title: "提示",
                                content: `年度任务默认时分秒均为0
                                （即2026-09-30的任务默认29日晚、30日凌晨截止） ,
                                月度默认分钟为0`,
                                closable: true,
                                centered: true,
                                okText: "确认",
                            })

                        }
                    >注意*</button>
                    <br />
                    <div style={{
                        flex: 'none'
                    }}>
                        <span style={{
                            margin: "10px 0px"
                        }}>任务结束时间:
                            <span style={{
                                color:"red",
                                margin:'0 0 0 10px',
                                cursor:'pointer'
                            }}
                            onClick={()=>Modal.info({
                                content:'不填此项的任务将不限时,请谨慎选择',
                                centered:true
                            })}
                            >注意*</span>
                        </span>
                        <DatePicker
                            showTime={selectTime === 3 || selectTime === 2}
                            value={endTime}
                            onChange={(date) => setEndTime(date)}
                            format={picker[selectTime]}
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                            disabledTime={(current) => {
                                if (!current || !current.isSame(dayjs(), 'day')) return {};
                                const now = dayjs();
                                return {
                                    disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
                                    disabledMinutes: (selectedHour) => {
                                        if (selectedHour !== now.hour()) return [];
                                        return Array.from({ length: now.minute() }, (_, i) => i);
                                    },
                                };
                            }}
                        />
                    </div>

                </div>
                <div>
                    <span>{"标题: "}</span>
                    <input placeholder='输入标题' name='title'
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div>
                    <span>{"任务内容: "}</span>
                    <input placeholder='输入任务内容' name='content'
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    ></input>
                </div>
                <div>
                    <span>优先级: </span>
                    <span style={{ color: 'red', marginLeft: "15px" }}>high</span>
                    <input name='priority' type='radio' checked={priority === 1} onChange={() => setPriority(1)} />
                    <span style={{ color: 'green', marginLeft: "15px" }}>middle</span>
                    <input name='priority' type='radio' checked={priority === 2} onChange={() => setPriority(2)} />
                    <span style={{ color: 'rgb(109, 208, 202)', marginLeft: "15px" }}>low</span>
                    <input name='priority' type='radio' checked={priority === 3} onChange={() => setPriority(3)} />
                    <br />
                </div>
                <button
                    disabled={isSubmit}
                    type='submit'>{isSubmit ? "Loading..." : "发布任务"}</button>
            </form>

        </div>
    )
}

export default Publish;