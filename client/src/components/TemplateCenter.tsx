import React, { useState, useEffect, useMemo } from 'react';
import {
  Template,
  TemplatePreview,
  ReplaceableGroupConfig,
  ReplacementSlotPreview,
} from '../types';
import { templateApi } from '../services/api';

interface TemplateCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    templateId?: string,
    replacements?: Record<string, string[]>
  ) => void;
}

const issueColor: Record<string, string> = {
  empty: '#6b7280',
  'too-long': '#dc2626',
  duplicate: '#d97706',
  config: '#dc2626',
};

const buildEmptyReplacements = (
  template: Template | undefined
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  template?.replaceable?.groups.forEach((group) => {
    result[group.key] = group.slots.map(() => '');
  });
  return result;
};

/** 关键字段替换表单 + 创建前替换结果预览 */
const ReplacementPanel: React.FC<{
  template: Template;
  values: Record<string, string[]>;
  preview: TemplatePreview | null;
  loading: boolean;
  previewError: string | null;
  onChange: (groupKey: string, slotIndex: number, value: string) => void;
}> = ({ template, values, preview, loading, previewError, onChange }) => {
  const groups = template.replaceable?.groups || [];

  const previewMap = useMemo(() => {
    const map = new Map<string, ReplacementSlotPreview>();
    preview?.groups.forEach((group) => {
      group.slots.forEach((slot) => map.set(`${group.key}:${slot.slotIndex}`, slot));
    });
    return map;
  }, [preview]);

  const replacedCount =
    preview?.groups.reduce(
      (sum, group) => sum + group.slots.filter((slot) => slot.replaced).length,
      0
    ) ?? 0;
  const totalCount =
    preview?.groups.reduce((sum, group) => sum + group.slots.length, 0) ?? 0;

  const renderGroupFields = (group: ReplaceableGroupConfig) => (
    <div
      key={group.key}
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
          {group.label}
        </h4>
        {group.emptyHint && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
            {group.emptyHint}
          </p>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {group.slots.map((slotConfig, slotIndex) => {
          const maxLength = slotConfig.maxLength || group.maxLength;
          const value = values[group.key]?.[slotIndex] || '';
          const slotPreview = previewMap.get(`${group.key}:${slotIndex}`);
          const issue = slotPreview?.issues[0];
          const replaced = !!slotPreview?.replaced;
          const length = Array.from(value.trim()).length;
          const overLimit = maxLength ? length > maxLength : false;
          const statusColor = replaced
            ? '#059669'
            : issue
            ? issueColor[issue.type] || '#6b7280'
            : '#9ca3af';

          return (
            <div key={`${group.key}-${slotIndex}`}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#6b7280',
                  marginBottom: '4px',
                }}
              >
                <span>{group.itemLabel} {slotIndex + 1}</span>
                <span style={{ color: overLimit ? '#dc2626' : '#9ca3af' }}>
                  {length}/{maxLength}
                </span>
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(group.key, slotIndex, e.target.value)}
                placeholder={group.inputPlaceholder || slotPreview?.originalValue || ''}
                maxLength={maxLength + 20}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  border: `1px solid ${overLimit ? '#fca5a5' : '#d1d5db'}`,
                  borderRadius: '6px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  if (!overLimit) e.target.style.borderColor = '#667eea';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = overLimit ? '#fca5a5' : '#d1d5db';
                }}
              />
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '11px',
                  lineHeight: 1.4,
                  color: statusColor,
                  minHeight: '15px',
                }}
                title={issue?.message || ''}
              >
                {replaced
                  ? '✓ 将替换为该内容'
                  : issue
                  ? issue.message
                  : value.trim() === ''
                  ? '未填写，保留模板原内容'
                  : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      style={{
        marginTop: '20px',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 600,
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✏️</span> 按实际内容替换关键字段
        </h3>
        {preview && (
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>{replacedCount} 项替换</span>
            {' / '}
            <span style={{ color: '#6b7280', fontWeight: 600 }}>{totalCount - replacedCount} 项保留原模板</span>
          </span>
        )}
        {loading && <span style={{ fontSize: '12px', color: '#667eea' }}>预览计算中…</span>}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#9ca3af' }}>
        字段为空、与同组其它字段重复、或内容超过长度上限时，将保留模板原内容，具体位置见下方替换结果。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {groups.map(renderGroupFields)}
      </div>

      {previewError && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            color: '#b45309',
            fontSize: '12px',
          }}
        >
          {previewError}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: '16px' }}>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
            }}
          >
            创建后画板内容预览
          </h4>
          {preview.groups.map((group) => (
            <div key={group.key} style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  marginBottom: '6px',
                }}
              >
                {group.label}
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        background: '#f3f4f6',
                        color: '#6b7280',
                        fontWeight: 500,
                        width: '110px',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      位置
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        background: '#f3f4f6',
                        color: '#6b7280',
                        fontWeight: 500,
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      模板原内容
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        background: '#f3f4f6',
                        color: '#6b7280',
                        fontWeight: 500,
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      创建后内容
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.slots.map((slot) => (
                    <tr key={`${group.key}-${slot.slotIndex}`}>
                      <td
                        style={{
                          padding: '6px 8px',
                          color: '#374151',
                          whiteSpace: 'nowrap',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        {slot.position}
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {slot.layerName}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          color: '#6b7280',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <span style={{ whiteSpace: 'pre-wrap' }}>
                          {slot.originalValue || slot.originalText}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #e5e7eb',
                          color: slot.replaced ? '#059669' : '#374151',
                          fontWeight: slot.replaced ? 600 : 400,
                        }}
                      >
                        <span style={{ whiteSpace: 'pre-wrap' }}>{slot.finalText}</span>
                        {!slot.replaced && slot.issues[0] && (
                          <span
                            style={{
                              display: 'block',
                              marginTop: '2px',
                              fontSize: '11px',
                              color: issueColor[slot.issues[0].type] || '#6b7280',
                              fontWeight: 400,
                            }}
                          >
                            保留原内容：{slot.issues[0].message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TemplateCenter: React.FC<TemplateCenterProps> = ({ isOpen, onClose, onCreate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacements, setReplacements] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setSelectedTemplate(null);
      setName('');
      setError(null);
      setReplacements({});
      setPreview(null);
      setPreviewError(null);
    }
  }, [isOpen]);

  const selectedTpl = templates.find((t) => t._id === selectedTemplate);

  // 防抖实时预览：判定规则以后端为准，创建前先展示替换结果
  useEffect(() => {
    if (!selectedTpl?.replaceable) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await templateApi.previewReplacements(selectedTpl!._id, replacements);
        if (!cancelled) {
          setPreview(data);
          setPreviewError(null);
        }
      } catch (previewErr) {
        console.error('Failed to preview replacements:', previewErr);
        if (!cancelled) {
          setPreviewError('替换预览暂不可用，创建时仍会按相同规则校验');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, replacements, templates]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t._id === templateId);
    setReplacements(buildEmptyReplacements(template));
    setPreview(null);
    setPreviewError(null);
  };

  const handleSelectBlank = () => {
    setSelectedTemplate(null);
    setReplacements({});
    setPreview(null);
    setPreviewError(null);
  };

  const handleReplacementChange = (groupKey: string, slotIndex: number, value: string) => {
    setReplacements((prev) => {
      const groupValues = [...(prev[groupKey] || [])];
      groupValues[slotIndex] = value;
      return { ...prev, [groupKey]: groupValues };
    });
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

  if (!isOpen) return null;

  const getBoardName = () =>
    name.trim() ||
    (selectedTemplate
      ? templates.find((t) => t._id === selectedTemplate)?.name || '未命名白板'
      : '未命名白板');

  const finishCreate = async (create: () => Promise<void> | void) => {
    if (creating) return;
    try {
      setCreating(true);
      setError(null);
      await create();
      setName('');
      setSelectedTemplate(null);
      setReplacements({});
      setPreview(null);
      onClose();
    } catch (err) {
      console.error('Failed to create board:', err);
      setError('创建白板失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    const templateReplacements = selectedTpl?.replaceable ? replacements : undefined;
    finishCreate(() =>
      onCreate(getBoardName(), selectedTemplate, templateReplacements)
    );
  };

  const handleCreateBlank = () => {
    finishCreate(() => onCreate(name.trim() || '未命名白板', undefined));
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
        <span
          style={{
            fontSize: '48px',
          }}
        >
          {template.icon}
        </span>
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ padding: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: '6px',
          }}
        >
          {template.name}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: '#6b7280',
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
        {template.replaceable && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '8px',
              fontSize: '11px',
              color: '#667eea',
              background: '#eef2ff',
              borderRadius: '10px',
              padding: '2px 8px',
            }}
          >
            支持替换关键字段
          </span>
        )}
      </div>
    </div>
  );

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '900px',
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
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              模板中心
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '14px',
                color: '#6b7280',
              }}
            >
              选择一个模板快速开始，或创建空白白板
            </p>
          </div>
          <button
            onClick={onClose}
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
          <div
            style={{
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
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

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
            }}
          >
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
                onClick={handleSelectBlank}
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
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1a1a1a',
                    }}
                  >
                    空白白板
                  </h3>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '13px',
                      color: '#6b7280',
                    }}
                  >
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
                      onClick={() => handleSelectTemplate(template._id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedTpl?.replaceable && (
              <ReplacementPanel
                template={selectedTpl}
                values={replacements}
                preview={preview}
                loading={previewLoading}
                previewError={previewError}
                onChange={handleReplacementChange}
              />
            )}
          </div>

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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                {selectedTemplate
                  ? `已选择：${templates.find((t) => t._id === selectedTemplate)?.name}`
                  : '已选择：空白白板'}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onClose}
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
                  取消
                </button>
                {selectedTemplate === null ? (
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
                    {creating ? '创建中...' : '使用模板创建'}
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
