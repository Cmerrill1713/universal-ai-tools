export var AgentCategory;
(function (AgentCategory) {
    AgentCategory["CORE"] = "core";
    AgentCategory["COGNITIVE"] = "cognitive";
    AgentCategory["PERSONAL"] = "personal";
    AgentCategory["UTILITY"] = "utility";
    AgentCategory["SPECIALIZED"] = "specialized";
})(AgentCategory || (AgentCategory = {}));
export var TaskType;
(function (TaskType) {
    TaskType["CODE_GENERATION"] = "code_generation";
    TaskType["CODE_REVIEW"] = "code_review";
    TaskType["CODE_DEBUGGING"] = "code_debugging";
    TaskType["CODE_EXPLANATION"] = "code_explanation";
    TaskType["CODE_REFACTORING"] = "code_refactoring";
    TaskType["CODE_TESTING"] = "code_testing";
    TaskType["DATA_ANALYSIS"] = "data_analysis";
    TaskType["DATA_VISUALIZATION"] = "data_visualization";
    TaskType["DATA_EXTRACTION"] = "data_extraction";
    TaskType["DATA_TRANSFORMATION"] = "data_transformation";
    TaskType["RESEARCH_SYNTHESIS"] = "research_synthesis";
    TaskType["RESEARCH_DISCOVERY"] = "research_discovery";
    TaskType["LITERATURE_REVIEW"] = "literature_review";
    TaskType["RESEARCH"] = "research";
    TaskType["CREATIVE_WRITING"] = "creative_writing";
    TaskType["CREATIVE_BRAINSTORMING"] = "creative_brainstorming";
    TaskType["CONTENT_GENERATION"] = "content_generation";
    TaskType["BRAINSTORMING"] = "brainstorming";
    TaskType["QUESTION_ANSWERING"] = "question_answering";
    TaskType["FACT_CHECKING"] = "fact_checking";
    TaskType["EXPLANATION"] = "explanation";
    TaskType["FACTUAL_QA"] = "factual_qa";
    TaskType["DOCUMENT_SUMMARIZATION"] = "document_summarization";
    TaskType["DOCUMENT_TRANSLATION"] = "document_translation";
    TaskType["DOCUMENT_EDITING"] = "document_editing";
    TaskType["SUMMARIZATION"] = "summarization";
    TaskType["TRANSLATION"] = "translation";
    TaskType["PROJECT_PLANNING"] = "project_planning";
    TaskType["TASK_DECOMPOSITION"] = "task_decomposition";
    TaskType["STRATEGY_FORMULATION"] = "strategy_formulation";
    TaskType["LOGICAL_REASONING"] = "logical_reasoning";
    TaskType["MATHEMATICAL_REASONING"] = "mathematical_reasoning";
    TaskType["CAUSAL_REASONING"] = "causal_reasoning";
    TaskType["REASONING"] = "reasoning";
    TaskType["AGENT_ORCHESTRATION"] = "agent_orchestration";
    TaskType["AGENT_COLLABORATION"] = "agent_collaboration";
    TaskType["SYSTEM_OPTIMIZATION"] = "system_optimization";
    TaskType["SYSTEM_MONITORING"] = "system_monitoring";
    TaskType["ERROR_DIAGNOSIS"] = "error_diagnosis";
    TaskType["CASUAL_CHAT"] = "casual_chat";
    TaskType["TECHNICAL_SUPPORT"] = "technical_support";
    TaskType["IMAGE_ANALYSIS"] = "image_analysis";
    TaskType["IMAGE_DESCRIPTION"] = "image_description";
    TaskType["VISUAL_REASONING"] = "visual_reasoning";
    TaskType["MODEL_TRAINING"] = "model_training";
    TaskType["GENERAL"] = "general";
    TaskType["UNKNOWN"] = "unknown";
})(TaskType || (TaskType = {}));
export const apiResponse = {
    success: (data, message) => ({
        success: true,
        data,
        message: message || 'Operation successful'
    }),
    error: (message, code, details) => ({
        success: false,
        error: {
            message,
            code: code || 'ERROR',
            details
        }
    })
};
//# sourceMappingURL=index.js.map