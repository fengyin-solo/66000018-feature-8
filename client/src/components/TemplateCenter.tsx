import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Template,
  ReplacementPreview,
  ReplacementFieldResult,
  ReplacementStatus,
} from '../types';
import { templateApi } from '../services/api';

interface TemplateCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateId?: string, replacements?: Record<string, string>) => void;
}

const STATUS_META: Record<
  ReplacementStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  replaced: { label: '已替换', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  empty: { label: '字段为空 · 保留原文', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  placeholder: { label: '重复占位符 · 保留原文', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  'too-long': { label: '超过长度上限 · 保留原文', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
};

export const TemplateCenter: React.FC<TemplateCenterProps> = ({ isOpen, onClose, onCreate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 替换流程：select 选择模板/空白；replace 填写关键字段并预览替换结果
  const [step, setStep] = useState<'select' | 'replace'>('select');
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ReplacementPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSeq = useRef(0);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      resetFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }, []);

  const resetFlow = () => {
    setSelectedTemplate(null);
    setName('');
    setError(null);
    setStep('select');
    setReplacements({});
    setPreview(null);
    setPreviewLoading(false);
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await templateApi.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError('加载模板失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateObj = templates.find((t) => t._id === selectedTemplate) || null;

  // 拉取创建前预览（判定规则以服务端为准），输入防抖 300ms
  const fetchPreview = useCallback(async (templateId: string, values: Record<string, string>) => {
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    try {
      const data = await templateApi.previewTemplateReplacements(templateId, values);
      if (seq === previewSeq.current) setPreview(data);
    } catch (error) {
      console.error('Failed to preview replacements:', error);
      if (seq === previewSeq.current) setError('替换结果预览失败，请重试');
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false);
    }
  }, []);

  const enterReplaceStep = () => {
    if (!selectedTemplateObj?.replaceable || !selectedTemplateObj.fieldGroups) return;
    const initial: Record<string, string> = {};
    selectedTemplateObj.fieldGroups.forEach((group) => {
      group.fields.forEach((field) => {
        initial[field.key] = replacements[field.key] ?? '';
      });
    });
    setReplacements(initial);
    setError(null);
    setStep('replace');
    fetchPreview(selectedTemplateObj._id, initial);
  };

  const handleReplacementChange = (key: string, value: string) => {
    const next = { ...replacements, [key]: value };
    setReplacements(next);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (selectedTemplate) {
      previewTimer.current = setTimeout(() => fetchPreview(selectedTemplate, next), 300);
    }
  };

  const backToSelect = () => {
    setStep('select');
    setPreview(null);
    setError(null);
  };

  const doCreate = async (boardName: string, templateId?: string) => {
    if (creating) return;
    try {
      setCreating(true);
      setError(null);
      await onCreate(
        boardName,
        templateId,
        templateId && selectedTemplateObj?.replaceable ? replacements : undefined
      );
      resetFlow();
      onClose();
    } catch (error) {
      console.error('Failed to create board:', error);
      setError('创建白板失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (creating || !selectedTemplate) return;

    if (step === 'select' && selectedTemplateObj?.replaceable) {
      enterReplaceStep();
      return;
    }

    const boardName =
      name.trim() || selectedTemplateObj?.name || '未命名白板';
    doCreate(boardName, selectedTemplate);
  };

  const handleCreateBlank = () => {
    const boardName = name.trim() || '未命名白板';
    doCreate(boardName, undefined);
  };

  const TemplateCard: React.FC<{
    template: Template;
    selected: boolean;
    onClick: () => void;
  }> = ({ template, selected, onClick }) => (
    <div
      onClick={onClick}
      style={{
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: selected ? '2px solid #667eea' : '2px solid transparent',
        boxShadow: selected
          ? '0 8px 24px rgba(102, 126, 234, 0.25)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s',
        background: '#fff',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
        }
      }}
    >
      {template.replaceable && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 1,
            padding: '2px 8px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.92)',
            color: '#5b21b6',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          可替换关键字段
        </div>
      )}
      <div
        style={{
          height: '140px',
          background: template.thumbnail,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: '48px' }}>{template.icon}</span>
        {selected && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '6px' }}>
          {template.name}
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
          {template.description}
        </p>
      </div>
    </div>
  );

  // ---- 替换步骤中的单个字段行（原内容 → 替换结果 + 判定）----
  const ReplacementFieldRow: React.FC<{
    field: ReplacementFieldResult | undefined;
    metaKey: string;
    metaLabel: string;
    metaMaxLength: number;
    layerName: string;
    originalText: string;
  }> = ({ field, metaKey, metaLabel, metaMaxLength, layerName, originalText }) => {
    const value = replacements[metaKey] ?? '';
    const status = field?.status;
    const statusMeta = status ? STATUS_META[status] : null;
    const overInput = Array.from(value).length > metaMaxLength;

    return (
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '14px 16px',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              {metaLabel}
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '8px', fontSize: '12px' }}>
                图层：{layerName}
              </span>
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => handleReplacementChange(metaKey, e.target.value)}
              placeholder={`原内容：${originalText}`}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '14px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                outline: 'none',
                border: `1px solid ${
                  status === 'placeholder' || status === 'too-long'
                    ? statusMeta!.border
                    : overInput
                      ? '#fca5a5'
                      : '#d1d5db'
                }`,
                background: overInput || status === 'placeholder' || status === 'too-long' ? '#fffdfd' : '#fff',
              }}
              onFocus={(e) => {
                if (!overInput && status !== 'placeholder' && status !== 'too-long') {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = 'none';
                if (!overInput && status !== 'placeholder' && status !== 'too-long') {
                  e.target.style.borderColor = '#d1d5db';
                }
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '6px',
                fontSize: '12px',
                color: overInput ? '#dc2626' : '#9ca3af',
              }}
            >
              <span>留空则保留原模板内容；不可填写 “___” 形式的占位符</span>
              <span>
                {Array.from(value).length}/{metaMaxLength} 字
              </span>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: '8px',
              padding: '10px 12px',
              background: statusMeta?.bg ?? '#f9fafb',
              border: `1px solid ${statusMeta?.border ?? '#e5e7eb'}`,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: statusMeta?.color ?? '#6b7280',
                marginBottom: '4px',
              }}
            >
              {statusMeta?.label ?? '等待预览…'}
            </div>
            <div style={{ fontSize: '13px', color: '#374151', wordBreak: 'break-all' }}>
              画板上显示：{field?.finalText ?? originalText}
            </div>
            {field && field.status !== 'replaced' && (
              <div style={{ fontSize: '12px', color: statusMeta?.color ?? '#6b7280', marginTop: '4px' }}>
                {field.message}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---- 第二步：填写关键字段并预览 ----
  const renderReplaceStep = () => {
    if (!selectedTemplateObj?.fieldGroups) return null;
    const fieldResultMap = new Map<string, ReplacementFieldResult>();
    preview?.groups.forEach((group) => {
      group.fields.forEach((field) => fieldResultMap.set(field.key, field));
    });

    return (
      <div style={{ padding: '20px 32px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px',
          }}
        >
          <button
            type="button"
            onClick={backToSelect}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#667eea',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ← 返回选择模板
          </button>
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 600, color: '#1a1a1a' }}>
          替换「{selectedTemplateObj.name}」的关键字段
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
          按本次会议/流程的实际内容填写；右侧为创建前的替换结果预览。字段为空、含重复占位符（___）或超过长度上限时，将保留原模板内容。
        </p>

        {preview && (
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#047857',
                fontWeight: 600,
              }}
            >
              将替换 {preview.appliedCount} 项
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                background: preview.skippedCount > 0 ? '#fef2f2' : '#f3f4f6',
                color: preview.skippedCount > 0 ? '#b91c1c' : '#6b7280',
                fontWeight: 600,
              }}
            >
              异常保留原文 {preview.skippedCount} 项
            </span>
            {previewLoading && <span style={{ color: '#9ca3af' }}>预览更新中…</span>}
          </div>
        )}

        {selectedTemplateObj.fieldGroups.map((group) => (
          <div key={group.key} style={{ marginBottom: '22px' }}>
            <h4
              style={{
                margin: '0 0 10px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#4c1d95',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '14px',
                  borderRadius: '2px',
                  background: '#7c3aed',
                  display: 'inline-block',
                }}
              />
              {group.label}
              <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '12px' }}>
                （图层：{group.layerName}）
              </span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {group.fields.map((field) => (
                <ReplacementFieldRow
                  key={field.key}
                  field={fieldResultMap.get(field.key)}
                  metaKey={field.key}
                  metaLabel={field.label}
                  metaMaxLength={field.maxLength}
                  layerName={field.layerName}
                  originalText={field.originalText}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => {
        if (!creating) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '960px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: '#1a1a1a' }}>
              {step === 'replace' ? '套用模板并替换关键字段' : '模板中心'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
              {step === 'replace'
                ? '创建前可预览每一处替换结果'
                : '选择一个模板快速开始，或创建空白白板'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {step === 'select' && (
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #e5e7eb' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                白板名称
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  selectedTemplate
                    ? templates.find((t) => t._id === selectedTemplate)?.name || '请输入白板名称'
                    : '请输入白板名称'
                }
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          )}

          {step === 'replace'
            ? renderReplaceStep()
            : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3
                    style={{
                      margin: '0 0 16px',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>📄</span> 空白白板
                  </h3>
                  <div
                    onClick={() => setSelectedTemplate(null)}
                    style={{
                      width: '220px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: selectedTemplate === null ? '2px solid #667eea' : '2px solid transparent',
                      boxShadow: selectedTemplate === null
                        ? '0 8px 24px rgba(102, 126, 234, 0.25)'
                        : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s',
                      background: '#fff',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTemplate !== null) {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTemplate !== null) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                      }
                    }}
                  >
                    <div
                      style={{
                        height: '140px',
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="9" x2="15" y2="9" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      {selectedTemplate === null && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: '#667eea',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                        空白白板
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        从零开始创建
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3
                    style={{
                      margin: '0 0 16px',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>✨</span> 精选模板
                  </h3>
                  {loading ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '16px',
                      }}
                    >
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          style={{
                            borderRadius: '12px',
                            height: '200px',
                            background: '#f3f4f6',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '16px',
                      }}
                    >
                      {templates.map((template) => (
                        <TemplateCard
                          key={template._id}
                          template={template}
                          selected={selectedTemplate === template._id}
                          onClick={() => setSelectedTemplate(template._id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          <div
            style={{
              padding: '20px 32px',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '13px',
                  marginBottom: '12px',
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                {step === 'replace'
                  ? `模板：${selectedTemplateObj?.name}${
                      preview ? `｜将替换 ${preview.appliedCount} 项，${preview.skippedCount} 项异常保留原文` : ''
                    }`
                  : selectedTemplate
                    ? `已选择：${templates.find((t) => t._id === selectedTemplate)?.name}`
                    : '已选择：空白白板'}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={step === 'replace' ? backToSelect : onClose}
                  disabled={creating}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.5 : 1,
                  }}
                >
                  {step === 'replace' ? '上一步' : '取消'}
                </button>
                {step === 'replace' ? (
                  <button
                    type="submit"
                    disabled={creating || previewLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      background: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: creating || previewLoading ? 'not-allowed' : 'pointer',
                      opacity: creating || previewLoading ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!creating && !previewLoading) e.currentTarget.style.background = '#5a67d8';
                    }}
                    onMouseLeave={(e) => {
                      if (!creating && !previewLoading) e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    {creating ? '创建中...' : '确认替换并创建画板'}
                  </button>
                ) : selectedTemplate === null ? (
                  <button
                    type="button"
                    onClick={handleCreateBlank}
                    disabled={creating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      background: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: creating ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                      opacity: creating ? 0.8 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!creating) e.currentTarget.style.background = '#5a67d8';
                    }}
                    onMouseLeave={(e) => {
                      if (!creating) e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    {creating && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ animation: 'spin 1s linear infinite' }}
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M4 12a8 8 0 018-8" />
                      </svg>
                    )}
                    {creating ? '创建中...' : '创建空白白板'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      background: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: creating ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                      opacity: creating ? 0.8 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!creating) e.currentTarget.style.background = '#5a67d8';
                    }}
                    onMouseLeave={(e) => {
                      if (!creating) e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    {creating && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ animation: 'spin 1s linear infinite' }}
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M4 12a8 8 0 018-8" />
                      </svg>
                    )}
                    {creating
                      ? '创建中...'
                      : selectedTemplateObj?.replaceable
                        ? '填写替换字段并预览 →'
                        : '使用模板创建'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
