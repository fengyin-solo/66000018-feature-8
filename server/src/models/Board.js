const mongoose = require('mongoose');

const layerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  visible: { type: Boolean, default: true },
  locked: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  elements: [{ type: mongoose.Schema.Types.Mixed }]
}, { timestamps: true });

const boardSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Untitled Board' },
  ownerId: { type: String, required: true },
  collaborators: [{ type: String }],
  layers: [layerSchema],
  width: { type: Number, default: 3000 },
  height: { type: Number, default: 2000 },
  backgroundColor: { type: String, default: '#ffffff' },
  // 来源模板及本次创建的字段替换结果（仅模板创建且发生替换时有值）
  templateId: { type: String },
  templateReplacements: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Board', boardSchema);
