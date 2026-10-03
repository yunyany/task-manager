import { useEffect, useState } from 'react';
import { getTasks, deleteTasks, updateTasks } from '../../api/tasks';
import { message, Modal } from 'antd'
import './task.css'
import dayjs from 'dayjs';


const Task = () => {
    const [tasks, setTasks] = useState([])
    const [selectall, setSelectall] = useState(true)
    const [selectpart, setSelectpart] = useState(false)

    const [selectTime, setSelectTime] = useState('1949/10/01')
    // 0-未完成  1-已完成  2-已过期
    const [priority, setPriority] = useState('all')
    // 提交按钮
    const [isInquire, setIsInquire] = useState(false)

    // 存储用户修改的信息
    const [editTitle, setEditTitle] = useState('')
    const [editDesc, setEditDesc] = useState('')

    // 当前操作的任务
    const [modalTask, setModalTask] = useState(null)
    // 操作进行中，用来禁用按钮防止连点 (连点会导致重复请求)
    const [isActing, setIsActing] = useState(false)

    //点击任务时，首先获取该任务的标题+内容
    const openModal = (task) => {
        setModalTask(task || '')
        setEditTitle(task.title || '')
        setEditDesc(task.description || '')
    }

    //选择分类
    const changeselect = (val) => {
        if (val === -1) {
            setSelectall(true)
        }
        else {
            setSelectall(false)
            setSelectpart(val)
        }
    }

    //获取时间，格式xxxx/xx/xx
    const handleTime = (val) => {
        const day = dayjs(new Date())
        if (val === '0') setSelectTime('1949/10/01')
        else if (val === '1') {
            setSelectTime(day.format('YYYY/MM/DD'))
        }
        else if (val === '2') {
            setSelectTime(day.subtract(3, 'day').format('YYYY/MM/DD'))
        }
        else if (val === '3') {
            setSelectTime(day.subtract(1, 'week').format('YYYY/MM/DD'))
        }
        else if (val === '4') {
            setSelectTime(day.subtract(1, 'month').format('YYYY/MM/DD'))
        }
        else if (val === '5') {
            setSelectTime(day.subtract(3, 'month').format('YYYY/MM/DD'))
        }
        else if (val === '6') {
            setSelectTime(day.subtract(1, 'year').format('YYYY/MM/DD'))
        }
    }

    const inquire = async () => {
        try {
            //组合要传入服务器的数据
            setIsInquire(true)
            const db = {
                created_at: selectTime,
                status: selectall ? 'all' : String(selectpart),
                priority: priority
            }
            const res = await getTasks(db)
            setTasks(res.tasks)
            message.open({
                content: "查询成功",
                type: 'success',
                duration: 1
            })
        } catch (err) {
            message.error(err.message)
        }
        setIsInquire(false)
    }

    // 删除任务
    const handleDelete = () => {
        if (isActing) return
        setIsActing(true)
        Modal.confirm({
            content: '确定删除?',
            centered: true,
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await deleteTasks(modalTask.id)
                    setTasks(prev => prev.filter(t => t.id !== modalTask.id))
                    message.success('删除成功')
                    setModalTask(null)          // 关弹窗
                } catch (err) {
                    message.error(err.message)
                }
            },
            onCancel(){
                message.success('取消成功')
            }
        })

        setIsActing(false)
    }

    // 标记完成
    const handleDone = async () => {
        if (isActing) return
        setIsActing(true)
        try {
            const res = await updateTasks(modalTask.id, {
                status: 1,
                description: modalTask.description,
                title: modalTask.title,
            })
            // 用后端返回的最新数据替换本地这一条（updated_at 已经是新的了）
            setTasks(prev => prev.map(t => t.id === modalTask.id ? res.task : t))
            message.success('任务已完成')
            setModalTask(null)
        } catch (err) {
            message.error(err.message)
        }
        setIsActing(false)
    }

    // 修改任务内容
    const handleEdit = async () => {
        const newTitle = editTitle.trim()
        if (!newTitle) {
            message.warning('标题不能为空')
            return
        }
        if (isActing) return
        setIsActing(true)
        try {
            const db = {
                title: editTitle,
                description: editDesc || null,
                status: modalTask.status
            }
            const res = await updateTasks(modalTask.id, db)
            setTasks(prev => prev.map(t => t.id === modalTask.id ? res.task : t))
            message.success('任务修改成功')
            setModalTask(null)
        } catch (err) {
            message.error(err.message)
        }
        setIsActing(false)
    }

    useEffect(() => {
        inquire()
    }, [])

    return (
        <div className='task-container'>
            <div className='task-title'>{"<>任务分类<>"}</div>
            <div className='task-choose'>
                <span>按是否完成分类</span>
                <div className='task-success'>
                    全选: <input onChange={() => changeselect(-1)} type='radio' checked={selectall} />
                    已完成:<input onChange={() => changeselect(1)} name='success' type='radio' checked={!selectall && selectpart == 1} />
                    未完成:<input onChange={() => changeselect(0)} name='success' type='radio' checked={!selectall && selectpart == 0} />
                    已过期:<input onChange={() => changeselect(2)} name='success' type='radio' checked={!selectall && selectpart == 2} />
                </div>
                <span>按发布时间分类</span>
                <select className='task-select' onChange={(e) => handleTime(e.target.value)}>
                    <option value={'0'} defaultChecked>所有时间</option>
                    <option value={'1'}>今日内</option>
                    <option value={'2'}>3日内</option>
                    <option value={'3'}>7日内</option>
                    <option value={'4'}>1月内</option>
                    <option value={'5'}>3月内</option>
                    <option value={'6'}>1年内</option>
                </select>
                <span>按优先级分类</span>
                <div className='task-priority'>
                    <span style={{ color: 'black', marginLeft: "15px" }}>全部</span>
                    <input name='priority' type='radio' checked={priority === 'all'} onChange={() => setPriority('all')} />
                    <span style={{ color: 'red', marginLeft: "15px" }}>high</span>
                    <input name='priority' type='radio' checked={priority === '1'} onChange={() => setPriority('1')} />
                    <span style={{ color: 'green', marginLeft: "15px" }}>middle</span>
                    <input name='priority' type='radio' checked={priority === '2'} onChange={() => setPriority('2')} />
                    <span style={{ color: 'rgb(109, 208, 202)', marginLeft: "15px" }}>low</span>
                    <input name='priority' type='radio' checked={priority === '3'} onChange={() => setPriority('3')} />
                </div>

                <button
                    onClick={() => inquire()}
                    disabled={isInquire}
                >{isInquire ? "Loading..." : "查询"}</button>
            </div>

            <div>{"<>任务展示<>"}
                <a
                    style={{ color: 'red', fontSize: '15px' }}
                    onClick={() => Modal.info({
                        content: "任务过期后就无法进行提交!",
                        centered: true
                    })}
                >注意*</a>
            </div>

            <div className='task-show'>
                {
                    tasks.length > 0 ? tasks.map(i => (
                        <div
                            onClick={() => openModal(i)}
                            key={i.id}
                            className={`task-map-item ${i.status == 1 ? '' : (i.status == 0 ? 'undone' : 'overtime')}`}>
                            <span className='task-status-badge'>
                                {i.status == 1 ? '已完成' : (i.status == 0 ? '未完成' : '已过期')}
                            </span>
                            <h3 className='task-map-title'>标题: {i.title}</h3>
                            内容:
                            <textarea
                                style={{
                                    width: "80%",
                                    border: '1px solid #ddd',
                                    outline: 'none',
                                    borderRadius: '8px',
                                    padding: '4px 6px',
                                    marginTop: '5px',
                                }}
                                placeholder={i.description ? '' : '暂无内容'}
                                readOnly
                                value={i.description || ''}
                                className='task-map-desc'></textarea>
                            <div className='task-map-other'>
                                <span>发布时间:{i.created_at.slice(0, 16)}</span>
                                <span>优先级:
                                    <span
                                        className={i.priority == 1 ? "high" : (
                                            i.priority == 2 ? "middle" : "low"
                                        )}
                                    >
                                        {i.priority == 1 ? "高" : (
                                            i.priority == 2 ? "中" : "低"
                                        )}
                                    </span>
                                </span>

                            </div>
                            <span
                                style={{
                                    fontSize: '13px',
                                    color: 'rgba(1,2,1,.5)'
                                }}
                            >{i.due_date ? `截止时间: ${i.due_date.slice(0, 16)}` : '不限时'}</span>
                        </div>
                    )) :
                        <div
                            className='task-none'
                        >{"暂无任务ヾ(≧▽≦*)o"}</div>
                }

            </div>

            {/* 任务操作弹窗：用 state 控制开关，比 Modal.confirm 灵活得多 */}
            <Modal
                open={!!modalTask}
                onCancel={() => setModalTask(null)}
                footer={null}
                centered
                title="任务操作"
                width={520}
            >
                {modalTask && (
                    <div className="task-modal-content">
                        {/* 当前任务信息 */}
                        <div className="task-modal-info">
                            <span className="info-label">当前任务：</span>
                            <span className="info-title">{modalTask.title}</span>
                        </div>

                        {/* 修改区 */}
                        <div className="task-modal-edit">
                            <div className="edit-row">
                                <label>修改标题</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="输入新标题"
                                />
                            </div>
                            <div className="edit-row">
                                <label>修改内容</label>
                                <textarea
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    placeholder="输入新内容"
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="task-modal-actions">
                            <button
                                type="button"
                                className="btn-delete"
                                disabled={isActing}
                                onClick={handleDelete}
                            >
                                删除任务
                            </button>

                            <button
                                type="button"
                                className={`btn-done ${modalTask.status !== 0 ? 'btn-isdone' : ''}`}
                                disabled={modalTask.status !== 0 || isActing}
                                onClick={handleDone}
                            >
                                确认完成任务
                            </button>

                            <button
                                type="button"
                                className="btn-save"
                                disabled={isActing}
                                onClick={handleEdit}
                            >
                                保存修改
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default Task;