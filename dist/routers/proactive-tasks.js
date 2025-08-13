import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '@/middleware/auth';
import { proactiveTaskManager } from '@/services/proactive-task-manager';
import { log, LogContext } from '@/utils/logger';
const router = Router();
router.get('/status', authenticate, async (req, res) => {
    try {
        const status = await proactiveTaskManager.getStatus();
        res.json({
            success: true,
            data: status,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get proactive task manager status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get status',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const tasks = await proactiveTaskManager.getUserTasks(userId);
        return res.json({
            success: true,
            data: tasks,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get tasks', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to get tasks',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/', authenticate, async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { title, description, trigger, scheduledFor, dueDate, recurringPattern, actionType, actionDetails, category, priority } = req.body;
        const task = await proactiveTaskManager.createTask({
            userId,
            title,
            description,
            triggerContext: trigger,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            recurringPattern,
            actionType: actionType || 'notification',
            actionDetails: actionDetails || {},
            category: category || 'action',
            priority: priority || 'medium'
        });
        return res.json({
            success: true,
            data: task,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to create task', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to create task',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.put('/:taskId', authenticate, async (req, res) => {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                error: 'Task ID is required',
                metadata: { requestId: uuidv4() }
            });
        }
        const updates = req.body;
        const task = await proactiveTaskManager.updateTask(taskId, updates);
        return res.json({
            success: true,
            data: task,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to update task', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to update task',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.delete('/:taskId', authenticate, async (req, res) => {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                error: 'Task ID is required',
                metadata: { requestId: uuidv4() }
            });
        }
        await proactiveTaskManager.deleteTask(taskId);
        return res.json({
            success: true,
            message: 'Task deleted successfully',
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to delete task', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to delete task',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/:taskId/execute', authenticate, async (req, res) => {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                error: 'Task ID is required',
                metadata: { requestId: uuidv4() }
            });
        }
        const result = await proactiveTaskManager.executeTask(taskId);
        return res.json({
            success: true,
            data: result,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to execute task', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to execute task',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/suggestions', authenticate, async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const suggestions = await proactiveTaskManager.getTaskSuggestions(userId);
        res.json({
            success: true,
            data: suggestions,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get task suggestions', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get suggestions',
            metadata: { requestId: uuidv4() }
        });
    }
});
export default router;
//# sourceMappingURL=proactive-tasks.js.map