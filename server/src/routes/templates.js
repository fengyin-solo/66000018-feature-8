const express = require('express');
const router = express.Router();
const { Board } = require('../storage');
const { getTemplates, getTemplateById } = require('../templates');
const {
  getReplaceableConfig,
  buildPreview,
  applyReplacements,
  buildTemplateSource,
} = require('../templates/replace');

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
      replaceable: t.replaceable || null,
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
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 替换结果预览：不创建画板、不修改模板，仅返回各字段替换/保留判定
router.post('/:id/preview', (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { replacements } = req.body || {};
    const preview = buildPreview(template, replacements || {});
    res.json(preview);
  } catch (err) {
    console.error('[Template] Error previewing replacements:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/create', async (req, res) => {
  try {
    const { name, ownerId, replacements } = req.body;
    const template = getTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    // 服务端重新判定并应用替换：空值 / 超长 / 同组重复的字段保留原模板内容
    const supportsReplacement = !!getReplaceableConfig(template);
    const preview = supportsReplacement
      ? buildPreview(template, replacements || {})
      : null;
    const effectiveTemplate = preview ? applyReplacements(template, preview) : template;

    const boardData = {
      name: name || template.name,
      ownerId,
      width: effectiveTemplate.width,
      height: effectiveTemplate.height,
      backgroundColor: effectiveTemplate.backgroundColor,
      layers: effectiveTemplate.layers.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
        elements: layer.elements,
      })),
    };

    // 保存本次替换结果，便于创建后追溯；未做替换的模板不带该字段
    if (preview) {
      boardData.templateSource = buildTemplateSource(template, preview);
    }

    const board = new Board(boardData);
    const savedBoard = await board.save();
    if (preview) {
      console.log(
        `[Template] Created board from template: ${savedBoard._id}, name: ${savedBoard.name}, ` +
          `layers: ${savedBoard.layers.length}, replaced: ${boardData.templateSource.replacedCount}, ` +
          `retained: ${boardData.templateSource.retainedCount}`
      );
    } else {
      console.log(`[Template] Created board from template: ${savedBoard._id}, name: ${savedBoard.name}, layers: ${savedBoard.layers.length}`);
    }
    res.status(201).json(savedBoard);
  } catch (err) {
    console.error('[Template] Error creating board from template:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
