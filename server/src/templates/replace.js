/**
 * 模板关键字段替换引擎
 *
 * 模板可通过 replaceable.groups 声明允许替换的字段组（如会议议程、参会人员、
 * 流程步骤、图例说明）。每个 slot 通过 elementId 定位模板中的文本元素。
 *
 * 判定规则（命中任意一条则该字段保留原模板内容，并在 issues 中指出具体位置与原因）：
 *  1. empty     —— 替换内容为空（未填写或仅空白字符）
 *  2. too-long  —— 替换内容超过该字段 maxLength 上限（按 Unicode 码点计数）
 *  3. duplicate —— 同一字段组内多个字段填入了相同内容
 */

const TOKEN_RE = /\{([a-zA-Z_]+)\}/g;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isBlankPlaceholder = (val) => /^_+$/.test(val);

const getReplaceableConfig = (template) =>
  template && template.replaceable && Array.isArray(template.replaceable.groups)
    ? template.replaceable
    : null;

/** 建立 elementId -> { element, layerName } 索引 */
const indexElements = (template) => {
  const map = new Map();
  (template.layers || []).forEach((layer) => {
    (layer.elements || []).forEach((element) => {
      if (element && element.id && !map.has(element.id)) {
        map.set(element.id, { element, layerName: layer.name });
      }
    });
  });
  return map;
};

/**
 * 将带 {n} / {value} 占位符的 pattern 转成正则。
 * {n} 匹配序号（数字），其余命名占位符匹配任意内容（非贪婪）。
 */
const patternToRegex = (pattern) => {
  const tokenNames = [];
  let source = '';
  let lastIndex = 0;

  for (const match of pattern.matchAll(TOKEN_RE)) {
    source += escapeRegExp(pattern.slice(lastIndex, match.index));
    tokenNames.push(match[1]);
    source += match[1] === 'n' ? '(\\d+)' : '([\\s\\S]+?)';
    lastIndex = match.index + match[0].length;
  }
  source += escapeRegExp(pattern.slice(lastIndex));

  return { regex: new RegExp(`^${source}$`), tokenNames };
};

/** 用实际值渲染 pattern，{n} 取字段序号，其余占位符取 values 中同名值 */
const renderPattern = (pattern, values) =>
  pattern.replace(TOKEN_RE, (full, name) =>
    name === 'n' ? String(values.n ?? '') : String(values[name] ?? '')
  );

/** 从模板现有文本中按 pattern 反解出主占位符的当前值；反解失败返回空串 */
const extractOriginalValue = (text, groupConfig, slotConfig) => {
  if (!text) return '';
  const pattern = slotConfig.pattern || groupConfig.pattern;
  const tokenName = slotConfig.token || groupConfig.token || 'value';
  if (!pattern.includes(`{${tokenName}}`)) return '';

  const { regex, tokenNames } = patternToRegex(pattern);
  const match = text.match(regex);
  if (!match) return '';

  const tokenIndex = tokenNames.indexOf(tokenName);
  if (tokenIndex === -1) return '';

  const value = (match[tokenIndex + 1] || '').trim();
  return isBlankPlaceholder(value) ? '' : value;
};

const codePointLength = (value) => Array.from(value).length;

/**
 * 计算替换预览（不落盘、不修改模板）。
 * @param {object} template 模板对象
 * @param {object} replacements { [groupKey]: string[] }，与组内 slots 顺序对应
 */
const buildPreview = (template, replacements = {}) => {
  const config = getReplaceableConfig(template);
  const groupsConfig = config ? config.groups : [];
  const elementIndex = indexElements(template);

  const groups = groupsConfig.map((groupConfig) => {
    const inputs = replacements[groupConfig.key];

    const slots = groupConfig.slots.map((slotConfig, slotIndex) => {
      const position = `${groupConfig.itemLabel} ${slotIndex + 1}`;
      const location = `${groupConfig.label} / ${position}`;
      const found = elementIndex.get(slotConfig.elementId);
      const originalText = found ? String(found.element.text || '') : '';
      const originalValue = found
        ? extractOriginalValue(originalText, groupConfig, slotConfig)
        : '';
      const rawInput =
        Array.isArray(inputs) && inputs[slotIndex] != null ? String(inputs[slotIndex]) : '';
      const inputValue = rawInput.trim();
      const maxLength = slotConfig.maxLength || groupConfig.maxLength;

      const slot = {
        groupKey: groupConfig.key,
        slotIndex,
        position,
        location,
        elementId: slotConfig.elementId,
        layerName: found ? found.layerName : '',
        originalValue,
        originalText,
        inputValue,
        value: '',
        finalText: originalText,
        replaced: false,
        issues: [],
      };

      if (!found) {
        slot.issues.push({
          type: 'config',
          message: `${location}（图层：${slot.layerName || '未知'}，元素：${slotConfig.elementId}）在模板中不存在，已保留原模板内容`,
        });
        return slot;
      }

      if (!inputValue) {
        slot.issues.push({
          type: 'empty',
          message: `${location}（图层：${slot.layerName}）替换内容为空，已保留原模板内容`,
        });
        return slot;
      }

      const length = codePointLength(inputValue);
      if (maxLength && length > maxLength) {
        slot.issues.push({
          type: 'too-long',
          message: `${location}（图层：${slot.layerName}）内容超过长度上限 ${maxLength} 字（当前 ${length} 字），已保留原模板内容`,
          maxLength,
          length,
        });
        return slot;
      }

      // 通过空值与长度校验，暂存待重复校验
      slot._acceptedValue = inputValue;
      return slot;
    });

    // 同组重复判定：值完全相同（区分大小写）的已通过字段，互相标记为重复
    if (groupConfig.checkDuplicate !== false) {
      const valueToSlots = new Map();
      slots.forEach((slot) => {
        if (slot.issues.length === 0 && slot._acceptedValue) {
          const list = valueToSlots.get(slot._acceptedValue) || [];
          list.push(slot);
          valueToSlots.set(slot._acceptedValue, list);
        }
      });

      valueToSlots.forEach((sameSlots) => {
        if (sameSlots.length < 2) return;
        sameSlots.forEach((slot) => {
          const others = sameSlots.filter((other) => other !== slot).map((other) => other.position);
          slot.issues.push({
            type: 'duplicate',
            message: `${slot.location}（图层：${slot.layerName}）与「${others.join('、')}」替换内容重复，已保留原模板内容`,
            duplicateWith: others,
          });
        });
      });
    }

    // 无问题的字段才真正替换
    slots.forEach((slot, slotIndex) => {
      if (slot.issues.length === 0 && slot._acceptedValue) {
        const slotConfig = groupConfig.slots[slotIndex];
        const pattern = slotConfig.pattern || groupConfig.pattern;
        const tokenName = groupConfig.token || 'value';
        slot.replaced = true;
        slot.value = slot._acceptedValue;
        slot.finalText = renderPattern(pattern, { n: slotIndex + 1, [tokenName]: slot.value });
      }
      delete slot._acceptedValue;
    });

    return {
      key: groupConfig.key,
      label: groupConfig.label,
      itemLabel: groupConfig.itemLabel,
      slots,
    };
  });

  return { templateId: template._id, groups };
};

/** 依据预览结果生成替换后的模板深拷贝（不修改原模板对象） */
const applyReplacements = (template, preview) => {
  const replaced = structuredClone(template);
  const elementIndex = indexElements(replaced);

  preview.groups.forEach((group) => {
    group.slots.forEach((slot) => {
      if (!slot.replaced) return;
      const entry = elementIndex.get(slot.elementId);
      if (entry) entry.element.text = slot.finalText;
    });
  });

  return replaced;
};

/** 生成随画板持久化的本次替换记录 */
const buildTemplateSource = (template, preview) => {
  let replacedCount = 0;
  let retainedCount = 0;

  const groups = preview.groups.map((group) => ({
    key: group.key,
    label: group.label,
    slots: group.slots.map((slot) => {
      if (slot.replaced) replacedCount += 1;
      else retainedCount += 1;
      return {
        position: slot.position,
        location: slot.location,
        elementId: slot.elementId,
        layerName: slot.layerName,
        originalValue: slot.originalValue,
        originalText: slot.originalText,
        value: slot.value,
        finalText: slot.finalText,
        replaced: slot.replaced,
        issues: slot.issues,
      };
    }),
  }));

  return {
    templateId: template._id,
    templateName: template.name,
    appliedAt: new Date().toISOString(),
    replacedCount,
    retainedCount,
    groups,
  };
};

module.exports = {
  getReplaceableConfig,
  buildPreview,
  applyReplacements,
  buildTemplateSource,
  patternToRegex,
  renderPattern,
};
