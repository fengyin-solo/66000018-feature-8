const { getTemplateById } = require('./index');

/**
 * 可替换关键字段配置
 *
 * 仅「会议纪要」与「流程梳理（业务流程）」模板声明了可替换字段；
 * 周计划等其它模板没有配置，套用流程保持不变。
 *
 * 判定规则（命中任意一条则保留原模板内容，并在结果中指出具体位置）：
 *  1. empty       字段为空（去除首尾空白后为空字符串）
 *  2. placeholder 重复占位符：替换内容中仍包含模板占位符（连续 3 个及以上下划线）
 *  3. too-long    替换内容超过字段长度上限（按 Unicode 码点计数，中文按 1 字计）
 */
const FIELD_GROUPS_BY_TEMPLATE = {
  // 会议纪要：固定议程 + 固定参会人员
  'template-meeting': [
    {
      key: 'agenda',
      label: '会议议程',
      layerName: '议程',
      fields: [
        { key: 'agenda-1', label: '议程 1', elementId: 'el-agenda-1', maxLength: 20, prefix: '1. ' },
        { key: 'agenda-2', label: '议程 2', elementId: 'el-agenda-2', maxLength: 20, prefix: '2. ' },
        { key: 'agenda-3', label: '议程 3', elementId: 'el-agenda-3', maxLength: 20, prefix: '3. ' },
        { key: 'agenda-4', label: '议程 4', elementId: 'el-agenda-4', maxLength: 20, prefix: '4. ' },
        { key: 'agenda-5', label: '议程 5', elementId: 'el-agenda-5', maxLength: 20, prefix: '5. ' },
      ],
    },
    {
      key: 'attendees',
      label: '参会人员',
      layerName: '参会人员',
      fields: [
        { key: 'attendee-1', label: '参会人员 1', elementId: 'el-attend-1', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-2', label: '参会人员 2', elementId: 'el-attend-2', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-3', label: '参会人员 3', elementId: 'el-attend-3', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-4', label: '参会人员 4', elementId: 'el-attend-4', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-5', label: '参会人员 5', elementId: 'el-attend-5', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-6', label: '参会人员 6', elementId: 'el-attend-6', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-7', label: '参会人员 7', elementId: 'el-attend-7', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-8', label: '参会人员 8', elementId: 'el-attend-8', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-9', label: '参会人员 9', elementId: 'el-attend-9', maxLength: 20, prefix: '□ ' },
        { key: 'attendee-10', label: '参会人员 10', elementId: 'el-attend-10', maxLength: 20, prefix: '□ ' },
      ],
    },
  ],
  // 业务流程：固定步骤图例
  'template-workflow': [
    {
      key: 'legend',
      label: '步骤图例',
      layerName: '流程图例',
      fields: [
        { key: 'legend-start', label: '图例：开始/结束', elementId: 'el-legend-start-text', maxLength: 6, prefix: '' },
        { key: 'legend-process', label: '图例：处理步骤', elementId: 'el-legend-process-text', maxLength: 6, prefix: '' },
        { key: 'legend-decision', label: '图例：决策判断', elementId: 'el-legend-decision-text', maxLength: 6, prefix: '' },
      ],
    },
  ],
};

const PLACEHOLDER_PATTERN = /_{3,}/;

const getFieldGroupsConfig = (templateId) => FIELD_GROUPS_BY_TEMPLATE[templateId] || null;

const hasReplaceableFields = (templateId) => !!FIELD_GROUPS_BY_TEMPLATE[templateId];

// 建立 elementId -> 所在图层/元素 的索引
const buildElementIndex = (template) => {
  const index = new Map();
  (template.layers || []).forEach((layer) => {
    (layer.elements || []).forEach((element) => {
      index.set(element.id, { layer, element });
    });
  });
  return index;
};

// 按 Unicode 码点计数，中文/emoji 均按 1 字计
const getTextLength = (value) => Array.from(value).length;

/**
 * 供模板列表使用的字段元数据（不含用户输入与判定结果）
 */
const getFieldGroupsMeta = (templateId) => {
  const groups = getFieldGroupsConfig(templateId);
  if (!groups) return null;
  const template = getTemplateById(templateId);
  const elementIndex = template ? buildElementIndex(template) : new Map();

  return groups.map((group) => ({
    key: group.key,
    label: group.label,
    layerName: group.layerName,
    fields: group.fields.map((field) => ({
      key: field.key,
      label: field.label,
      layerName: group.layerName,
      elementId: field.elementId,
      maxLength: field.maxLength,
      prefix: field.prefix || '',
      originalText: elementIndex.get(field.elementId)?.element?.text ?? '',
    })),
  }));
};

const judgeField = (field, originalText, rawValue) => {
  const value = (rawValue === undefined || rawValue === null ? '' : String(rawValue)).trim();
  const finalIfReplaced = `${field.prefix || ''}${value}`;

  if (!value) {
    return {
      status: 'empty',
      applied: false,
      inputValue: value,
      length: 0,
      finalText: originalText,
      message: '字段为空，保留原模板内容',
    };
  }

  if (PLACEHOLDER_PATTERN.test(value)) {
    return {
      status: 'placeholder',
      applied: false,
      inputValue: value,
      length: getTextLength(value),
      finalText: originalText,
      message: '替换内容与模板占位符重复（包含连续下划线 ___），保留原模板内容',
    };
  }

  const length = getTextLength(value);
  if (length > field.maxLength) {
    return {
      status: 'too-long',
      applied: false,
      inputValue: value,
      length,
      finalText: originalText,
      message: `替换内容超过长度上限（${length}/${field.maxLength} 字），保留原模板内容`,
    };
  }

  return {
    status: 'replaced',
    applied: true,
    inputValue: value,
    length,
    finalText: finalIfReplaced,
    message: '将替换原模板内容',
  };
};

/**
 * 根据用户输入生成替换预览（不修改模板本身）
 * 返回每个字段的原内容、替换结果、判定状态与具体位置。
 */
const buildReplacementPreview = (template, rawValues = {}) => {
  const groupsConfig = getFieldGroupsConfig(template._id);
  if (!groupsConfig) return null;

  const values = rawValues || {};
  const elementIndex = buildElementIndex(template);

  let appliedCount = 0;
  let skippedCount = 0;

  const groups = groupsConfig.map((groupConfig) => {
    const fields = groupConfig.fields.map((field) => {
      const located = elementIndex.get(field.elementId);
      const originalText = located ? String(located.element.text ?? '') : '';
      const result = judgeField(field, originalText, values[field.key]);

      if (result.applied) {
        appliedCount += 1;
      } else if (result.inputValue !== '' || Object.prototype.hasOwnProperty.call(values, field.key)) {
        // 仅在用户确实填了内容但被判无效时计入异常；完全没填属于正常跳过
        if (result.status !== 'empty') skippedCount += 1;
      }

      return {
        key: field.key,
        label: field.label,
        location: `${groupConfig.label} › ${field.label}（图层：${groupConfig.layerName}）`,
        layerName: groupConfig.layerName,
        elementId: field.elementId,
        maxLength: field.maxLength,
        prefix: field.prefix || '',
        originalText,
        ...result,
      };
    });

    return {
      key: groupConfig.key,
      label: groupConfig.label,
      layerName: groupConfig.layerName,
      fields,
    };
  });

  return {
    templateId: template._id,
    templateName: template.name,
    groups,
    appliedCount,
    skippedCount,
  };
};

/**
 * 将通过判定的替换值应用到模板的深拷贝上，并返回替换后的模板与快照。
 * 未通过判定（为空/重复占位符/超长）的字段保持原模板内容。
 */
const applyReplacements = (template, rawValues = {}) => {
  const preview = buildReplacementPreview(template, rawValues);
  if (!preview) {
    return { template, snapshot: null };
  }

  const replacedTemplate = JSON.parse(JSON.stringify(template));
  const elementIndex = buildElementIndex(replacedTemplate);

  preview.groups.forEach((group) => {
    group.fields.forEach((fieldResult) => {
      if (!fieldResult.applied) return;
      const located = elementIndex.get(fieldResult.elementId);
      if (located) {
        located.element.text = fieldResult.finalText;
      }
    });
  });

  const snapshot = {
    templateId: template._id,
    templateName: template.name,
    appliedAt: new Date().toISOString(),
    appliedCount: preview.appliedCount,
    skippedCount: preview.skippedCount,
    groups: preview.groups,
  };

  return { template: replacedTemplate, snapshot };
};

module.exports = {
  hasReplaceableFields,
  getFieldGroupsMeta,
  buildReplacementPreview,
  applyReplacements,
};
