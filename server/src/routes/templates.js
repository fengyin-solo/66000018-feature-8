const express = require('express');
const router = express.Router();
const { Board } = require('../storage');
const { getTemplates, getTemplateById } = require('../templates');
const {
  hasReplaceableFields,
  getFieldGroupsMeta,
  buildReplacementPreview,
  applyReplacements,
} = require('../templates/fields');

router.get('/', (req, res) => {
  try {
    const templates = getTemplates();
    const simplified = templates.map((t) => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      category: t.category,
      thumbnail: t.thumbnail,
      icon: t.icon,
      width: t.width,
      height: t.height,
      backgroundColor: t.backgroundColor,
      replaceable: hasReplaceableFields(t._id),
      fieldGroups: getFieldGroupsMeta(t._id),
    }));
    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({
      ...template,
      replaceable: hasReplaceableFields(template._id),
      fieldGroups: getFieldGroupsMeta(template._id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建前预览替换结果（不落库）
router.post('/:id/preview', (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { replacements } = req.body || {};
    const preview = buildReplacementPreview(template, replacements || {});

    if (!preview) {
      return res.status(400).json({ error: '该模板不支持字段替换' });
    }

    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/create', async (req, res) => {
  try {
    const { name, ownerId, replacements } = req.body;
    const sourceTemplate = getTemplateById(req.params.id);

    if (!sourceTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    // 仅当模板声明了可替换字段且传入了 replacements 时才执行替换；
    // 其它模板（如周计划）完全沿用原逻辑。
    const { template, snapshot } = hasReplaceableFields(sourceTemplate._id)
      ? applyReplacements(sourceTemplate, replacements || {})
      : { template: sourceTemplate, snapshot: null };

    const boardData = {
      name: name || template.name,
      ownerId,
      width: template.width,
      height: template.height,
      backgroundColor: template.backgroundColor,
      templateId: sourceTemplate._id,
      layers: template.layers.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
        elements: layer.elements,
      })),
    };

    if (snapshot) {
      boardData.templateReplacements = snapshot;
    }

    const board = new Board(boardData);
    const savedBoard = await board.save();
    console.log(
      `[Template] Created board from template: ${savedBoard._id}, name: ${savedBoard.name}, ` +
        `layers: ${savedBoard.layers.length}, replaced fields: ${snapshot ? snapshot.appliedCount : 0}`
    );
    res.status(201).json(savedBoard);
  } catch (err) {
    console.error('[Template] Error creating board from template:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
