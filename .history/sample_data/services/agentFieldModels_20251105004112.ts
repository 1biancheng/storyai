/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This file serves as the Field Model Library for the application.
// It defines the expected structured JSON output for various AI agents
// and provides a validation utility to ensure AI responses conform to these structures.

import { AgentRole } from '../../types.ts';

// Define custom types for application schema definitions
enum CustomType {
  OBJECT = 'object',
  ARRAY = 'array',
  STRING = 'string',
  INTEGER = 'integer',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

interface CustomSchemaProperty {
  type: CustomType;
  description?: string;
  items?: CustomSchemaProperty;
  properties?: Record<string, CustomSchemaProperty>;
  required?: string[];
}

interface CustomSchema {
  type: CustomType;
  properties?: Record<string, CustomSchemaProperty>;
  items?: CustomSchemaProperty;
  required?: string[];
}

// From user spec for Project Requirements
export const projectRequirementsSchema: CustomSchema = {
  type: CustomType.OBJECT,
  properties: {
    project_name: { type: CustomType.STRING, description: "项目名称" },
    novel_type: { type: CustomType.STRING, description: "小说类型" },
    chapter_count: { type: CustomType.INTEGER, description: "章节数量" },
    words_per_chapter: { type: CustomType.INTEGER, description: "每章字数" },
    total_words: { type: CustomType.INTEGER, description: "小说总字数" },
    theme: { type: CustomType.STRING, description: "主题思想" },
    setting: { type: CustomType.STRING, description: "故事背景和时代" },
    plot_summary: { type: CustomType.STRING, description: "情节概要" },
    chapter_plan: { type: CustomType.STRING, description: "大致的章节数量和结构" },
    character_introduction: { type: CustomType.STRING, description: "主要角色及其特点" },
    story_synopsis: { type: CustomType.STRING, description: "整个故事的简介" },
    world_building: { type: CustomType.STRING, description: "小说的世界观和规则" },
    character_details: { type: CustomType.STRING, description: "主要角色的详细背景和性格" }
  },
  required: [
    "project_name", "novel_type", "chapter_count", "words_per_chapter",
    "total_words", "theme", "setting", "plot_summary", "chapter_plan",
    "character_introduction", "story_synopsis", "world_building", "character_details"
  ]
};


// Schema for the Data Analysis agent to structure market preference data.
const preferenceItemSchema: CustomSchemaProperty = {
  type: CustomType.OBJECT,
  properties: {
    keyword: { type: CustomType.STRING, description: "流行的关键词" },
    popularity: { type: CustomType.NUMBER, description: "热度评分 (1-10)" },
    description: { type: CustomType.STRING, description: "该关键词流行的原因或表现形式" },
  },
  required: ["keyword", "popularity", "description"],
};

export const preferenceAnalysisSchema: CustomSchema = {
  type: CustomType.OBJECT,
  properties: {
    character_emotions: { type: CustomType.ARRAY, description: "人物情感偏好", items: preferenceItemSchema },
    novel_genres: { type: CustomType.ARRAY, description: "小说类型偏好", items: preferenceItemSchema },
    timeline_clues: { type: CustomType.ARRAY, description: "时代线索偏好", items: preferenceItemSchema },
    narrative_perspectives: { type: CustomType.ARRAY, description: "叙述视角偏好", items: preferenceItemSchema },
    main_plots: { type: CustomType.ARRAY, description: "主要情节偏好", items: preferenceItemSchema },
    character_traits: { type: CustomType.ARRAY, description: "角色特点偏好", items: preferenceItemSchema },
  },
  required: ["character_emotions", "novel_genres", "timeline_clues", "narrative_perspectives", "main_plots", "character_traits"],
};


// From user spec for Outline Agent: A comprehensive story outline model.
export const outlineModelSchema: CustomSchema = {
  type: CustomType.OBJECT,
  properties: {
    outline_model: {
      type: CustomType.OBJECT,
      description: "The main container for the story outline.",
      properties: {
        basic_info: {
          type: CustomType.OBJECT,
          properties: {
            story_type: { type: CustomType.STRING, description: "小说类型, 如科幻/悬疑" },
            target_audience: { type: CustomType.STRING, description: "目标读者, 如青少年/成人" },
            total_chapters: { type: CustomType.INTEGER, description: "总章节数" }
          },
          required: ["story_type", "target_audience", "total_chapters"]
        },
        core_elements: {
          type: CustomType.OBJECT,
          properties: {
            core_conflict: { type: CustomType.STRING, description: "核心冲突描述+类型" },
            theme: { type: CustomType.STRING, description: "主题立意+落地方式" },
            rhythm_plan: { type: CustomType.STRING, description: "分阶段节奏占比" },
            character_arcs: {
              type: CustomType.ARRAY,
              description: "核心角色的成长/转变轨迹",
              items: {
                type: CustomType.OBJECT,
                properties: {
                  character_name: { type: CustomType.STRING, description: "角色名" },
                  growth_trajectory: { type: CustomType.STRING, description: "成长轨迹" },
                  trigger_event: { type: CustomType.STRING, description: "关键触发事件" }
                },
                required: ["character_name", "growth_trajectory", "trigger_event"]
              }
            },
            plot_turning_points: {
              type: CustomType.ARRAY,
              description: "关键的情节转折点",
              items: {
                type: CustomType.OBJECT,
                properties: {
                  position: { type: CustomType.STRING, description: "例如:第5章" },
                  description: { type: CustomType.STRING, description: "转折点描述" },
                  impact: { type: CustomType.STRING, description: "对故事的影响" }
                },
                required: ["position", "description", "impact"]
              }
            }
          },
          required: ["core_conflict", "theme", "rhythm_plan", "character_arcs", "plot_turning_points"]
        },
        chapter_outline: {
          type: CustomType.ARRAY,
          description: "分章节大纲",
          items: {
            type: CustomType.OBJECT,
            properties: {
              chapter_name: { type: CustomType.STRING, description: "章节名" },
              core_plot: { type: CustomType.STRING, description: "核心情节" },
              related_arc_or_turning_point: { type: CustomType.STRING, description: "关联的角色弧光或转折点" }
            },
            required: ["chapter_name", "core_plot", "related_arc_or_turning_point"]
          }
        }
      },
      required: ["basic_info", "core_elements", "chapter_outline"]
    }
  },
  required: ["outline_model"]
};

// Schema for the Generator Agent, capable of creating various world-building elements.
const generatedCharacterSchema: CustomSchemaProperty = {
    type: CustomType.OBJECT,
    properties: {
        name: { type: CustomType.STRING, description: "角色的全名." },
        role: { type: CustomType.STRING, description: "角色在故事中的主要作用(例如,主角、反派、配角、导师)." },
        description: { type: CustomType.STRING, description: "对角色外观、个性和背景的详细描述." },
    },
    required: ["name", "role", "description"],
};

const generatedLocationSchema: CustomSchemaProperty = {
    type: CustomType.OBJECT,
    properties: {
        name: { type: CustomType.STRING, description: "地点的名称." },
        type: { type: CustomType.STRING, description: "地点的类型(例如,城市、森林、废墟、山脉、河流)." },
        description: { type: CustomType.STRING, description: "对地点的氛围、关键特征和在故事中重要性的描述." },
    },
    required: ["name", "type", "description"],
};

const generatedItemSchema: CustomSchemaProperty = {
    type: CustomType.OBJECT,
    properties: {
        name: { type: CustomType.STRING, description: "物品的名称." },
        effect: { type: CustomType.STRING, description: "物品的主要效果、功能或用途." },
        description: { type: CustomType.STRING, description: "对物品外观、来源和稀有度的描述." },
    },
    required: ["name", "effect", "description"],
};

const generatedFactionSchema: CustomSchemaProperty = {
    type: CustomType.OBJECT,
    properties: {
        name: { type: CustomType.STRING, description: "城镇或国家的名称." },
        governance: { type: CustomType.STRING, description: "其政治结构或统治方式(例如,君主制、共和国、部落)." },
        description: { type: CustomType.STRING, description: "对其文化、主要产业和在世界中地位的描述." },
    },
    required: ["name", "governance", "description"],
};

const generatedBeastSchema: CustomSchemaProperty = {
    type: CustomType.OBJECT,
    properties: {
        name: { type: CustomType.STRING, description: "妖兽的名称." },
        habitat: { type: CustomType.STRING, description: "其典型的栖息地." },
        abilities: { type: CustomType.STRING, description: "其特殊能力或攻击方式的描述." },
        description: { type: CustomType.STRING, description: "对妖兽外观、习性和危险等级的描述." },
    },
    required: ["name", "habitat", "abilities", "description"],
};

export const generatorModelSchema: CustomSchema = {
  type: CustomType.OBJECT,
  properties: {
    characters: { type: CustomType.ARRAY, description: "生成的角色列表.", items: generatedCharacterSchema },
    locations: { type: CustomType.ARRAY, description: "生成的地理位置列表.", items: generatedLocationSchema },
    flora: { type: CustomType.ARRAY, description: "生成的植物列表.", items: generatedItemSchema },
    towns: { type: CustomType.ARRAY, description: "生成的城镇列表.", items: generatedFactionSchema },
    elixirs: { type: CustomType.ARRAY, description: "生成的丹药或药剂列表.", items: generatedItemSchema },
    beasts: { type: CustomType.ARRAY, description: "生成的妖兽或魔法生物列表.", items: generatedBeastSchema },
    countries: { type: CustomType.ARRAY, description: "生成的国家或势力列表.", items: generatedFactionSchema },
    treasures: { type: CustomType.ARRAY, description: "生成的天材地宝或稀有物品列表.", items: generatedItemSchema },
  },
};

// New Schema for the Chapter Writer Agent
export const chapterWriterSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        chapter_title: { type: CustomType.STRING, description: "The full title of the chapter being written." },
        chapter_content: { type: CustomType.STRING, description: "The full text content of the chapter." },
        new_characters_introduced: {
            type: CustomType.ARRAY,
            description: "A list of any new characters introduced in this chapter.",
            items: {
                type: CustomType.OBJECT,
                properties: {
                    name: { type: CustomType.STRING, description: "Name of the new character." },
                    brief_description: { type: CustomType.STRING, description: "A brief description of their appearance, role, and how they were introduced." },
                },
                required: ["name", "brief_description"],
            }
        },
        plot_advancements: {
            type: CustomType.ARRAY,
            description: "A bulleted list of key plot points that were advanced in this chapter.",
            items: { type: CustomType.STRING }
        },
        unresolved_hooks: {
            type: CustomType.ARRAY,
            description: "A list of questions, mysteries, or hooks left at the end of the chapter to entice the reader.",
            items: { type: CustomType.STRING }
        },
        setting_description: { type: CustomType.STRING, description: "A summary of the primary setting and atmosphere of this chapter." }
    },
    required: ["chapter_title", "chapter_content"]
};

// New Schema for the Section Writer Agent
export const sectionWriterSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        original_section: { type: CustomType.STRING, description: "The original text that was provided for revision." },
        analysis: { type: CustomType.STRING, description: "A brief analysis of what was lacking in the original text (e.g., 'lacked sensory details', 'passive voice')." },
        revised_section: { type: CustomType.STRING, description: "The new, improved text for the section." },
        key_improvements: {
            type: CustomType.ARRAY,
            description: "A list of specific improvements that were made.",
            items: { type: CustomType.STRING, description: "e.g., 'Added olfactory details', 'Strengthened verb choices', 'Improved pacing'." }
        }
    },
    required: ["original_section", "analysis", "revised_section", "key_improvements"]
};

// New Schema for the Reviewer Agent
const reviewIssueSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        issue_description: { type: CustomType.STRING, description: "A clear and concise description of the issue found." },
        suggestion: { type: CustomType.STRING, description: "A specific, actionable suggestion for how to fix the issue." },
        location_reference: { type: CustomType.STRING, description: "An optional reference to where the issue occurs, e.g., 'In Chapter 3, paragraph 2'." }
    },
    required: ["issue_description", "suggestion"]
};

export const reviewerSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        word_count_analysis: {
            type: CustomType.OBJECT,
            properties: {
                current_word_count: { type: CustomType.INTEGER },
                target_word_count: { type: CustomType.INTEGER },
                status: { type: CustomType.STRING, description: "Either '达标' or '未达标'." }
            },
            required: ["current_word_count", "target_word_count", "status"]
        },
        content_quality_review: {
            type: CustomType.OBJECT,
            properties: {
                plot_and_logic: { type: CustomType.ARRAY, description: "A list of plot or logic issues.", items: reviewIssueSchema },
                pacing_and_structure: { type: CustomType.ARRAY, description: "A list of pacing or structural issues.", items: reviewIssueSchema },
                character_consistency: {
                    type: CustomType.ARRAY,
                    description: "A list of character consistency issues.",
                    items: {
                        type: CustomType.OBJECT,
                        properties: {
                            character_name: { type: CustomType.STRING },
                            issue_description: { type: CustomType.STRING },
                            suggestion: { type: CustomType.STRING }
                        },
                        required: ["character_name", "issue_description", "suggestion"]
                    }
                }
            },
            required: ["plot_and_logic", "pacing_and_structure", "character_consistency"]
        },
        overall_summary: { type: CustomType.STRING, description: "A high-level summary of the review findings." }
    },
    required: ["word_count_analysis", "content_quality_review", "overall_summary"]
};

// New Schema for the Editor Agent
export const editorSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        final_manuscript: { type: CustomType.STRING, description: "The complete, final, edited text of the novel." },
        edit_summary_log: {
            type: CustomType.ARRAY,
            description: "A list of the most significant changes made during the editing process.",
            items: {
                type: CustomType.OBJECT,
                properties: {
                    change_description: { type: CustomType.STRING, description: "e.g., 'Restructured Chapter 5 for better pacing', 'Rewrote dialogue in the climax'." },
                    reasoning: { type: CustomType.STRING, description: "Why the change was made, referencing the reviewer or quality evaluator's feedback." }
                },
                required: ["change_description", "reasoning"]
            }
        }
    },
    required: ["final_manuscript", "edit_summary_log"]
};

// New Schema for the Quality Evaluator Agent
export const qualityEvaluatorSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        overall_score: { type: CustomType.NUMBER, description: "The final score from 1 to 10." },
        dimensional_scores: {
            type: CustomType.ARRAY,
            description: "A breakdown of scores across different literary dimensions.",
            items: {
                type: CustomType.OBJECT,
                properties: {
                    dimension: { type: CustomType.STRING, description: "The dimension being scored, e.g., '故事性', '文笔', '创新性', '角色深度'." },
                    score: { type: CustomType.NUMBER, description: "The score for this dimension (1-10)." },
                    justification: { type: CustomType.STRING, description: "The reason for the given score." },
                    suggestion: { type: CustomType.STRING, description: "Specific advice for how to improve in this dimension." }
                },
                required: ["dimension", "score", "justification", "suggestion"]
            }
        },
        final_verdict: { type: CustomType.STRING, description: "A summary paragraph of the evaluation and overall thoughts." }
    },
    required: ["overall_score", "dimensional_scores", "final_verdict"]
};

// New Schema for the Summary Agent
export const summaryAgentSchema: CustomSchema = {
    type: CustomType.OBJECT,
    properties: {
        core_plot_summary: { type: CustomType.STRING, description: "A concise summary of the main events of the chapter." },
        continuity_points: {
            type: CustomType.OBJECT,
            properties: {
                characters_present: { type: CustomType.ARRAY, description: "List of characters who appeared or were significantly mentioned.", items: { type: CustomType.STRING } },
                key_locations: { type: CustomType.ARRAY, description: "List of settings where the chapter took place.", items: { type: CustomType.STRING } },
                foreshadowing_elements: { type: CustomType.ARRAY, description: "List of hooks, clues, or foreshadowing elements that were planted.", items: { type: CustomType.STRING } },
                resolved_threads: { type: CustomType.ARRAY, description: "List of previous plot points or questions that were resolved.", items: { type: CustomType.STRING } }
            },
            required: ["characters_present", "key_locations", "foreshadowing_elements", "resolved_threads"]
        },
        character_state_update: { type: CustomType.STRING, description: "A description of how the main characters' emotional states, goals, or relationships have changed by the end of the chapter." },
        next_chapter_directive: { type: CustomType.STRING, description: "The single most important instruction for the writer of the next chapter to ensure continuity." }
    },
    required: ["core_plot_summary", "continuity_points", "character_state_update", "next_chapter_directive"]
};

// Map to associate agent roles with their required output schemas.
const agentSchemaMap: Partial<Record<AgentRole, CustomSchema>> = {
  [AgentRole.COORDINATOR]: projectRequirementsSchema,
  [AgentRole.DATA_ANALYZER]: preferenceAnalysisSchema,
  [AgentRole.OUTLINE_GENERATOR]: outlineModelSchema,
  [AgentRole.GENERATOR_AGENT]: generatorModelSchema,
  [AgentRole.CHAPTER_WRITER]: chapterWriterSchema,
  [AgentRole.SECTION_WRITER]: sectionWriterSchema,
  [AgentRole.REVIEWER]: reviewerSchema,
  [AgentRole.EDITOR]: editorSchema,
  [AgentRole.QUALITY_EVALUATOR]: qualityEvaluatorSchema,
  [AgentRole.SUMMARY_AGENT]: summaryAgentSchema,
};

/**
 * Retrieves the JSON schema for a given agent role.
 * @param role The AgentRole to get the schema for.
 * @returns The Schema if one is defined for the role, otherwise null.
 */
export const getSchemaForAgent = (role: AgentRole): CustomSchema | null => {
  return agentSchemaMap[role] || null;
};


/**
 * Validates data against a schema, checking for missing required fields recursively.
 * This is a lightweight implementation designed for the "Field Compensation Mechanism".
 * It correctly handles nested objects and arrays, and does not flag an empty array as invalid.
 * @param data The data object to validate.
 * @param schema The schema to validate against.
 * @returns An object containing a boolean `isValid` and an array of `missingFields` paths.
 */
export const validateData = (data: any, schema: CustomSchema): { isValid: boolean, missingFields: string[] } => {
  const missingFields: string[] = [];

  /**
   * Recursively checks an object against a schema node.
   * @param obj The current data object or sub-object.
   * @param schemaNode The corresponding schema definition for the object.
   * @param path The current path for logging missing fields (e.g., "core_elements.character_arcs[0]").
   */
  function check(obj: any, schemaNode: CustomSchema, path: string = '') {
    // Only validate objects with properties.
    if (schemaNode.type !== CustomType.OBJECT || !schemaNode.properties || typeof obj !== 'object' || obj === null) {
      return;
    }
    
    const required = schemaNode.required || [];

    for (const key of required) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      // Check if the field is missing or null.
      if (value === undefined || value === null) {
        missingFields.push(fullPath);
        continue; // Don't check deeper if the key is missing.
      }
      
      const propertySchema = schemaNode.properties[key];
      if (!propertySchema) continue;

      // Recurse into nested objects.
      if (propertySchema.type === CustomType.OBJECT) {
        check(value, propertySchema as CustomSchema, fullPath);
      
      // Handle arrays: check items if the array is not empty.
      } else if (propertySchema.type === CustomType.ARRAY) {
        if (!Array.isArray(value)) {
            missingFields.push(`${fullPath} (is not an array)`);
        } else {
            const itemSchema = propertySchema.items;
            // IMPORTANT: An empty array is a valid value for a required array field.
            // We only validate the contents of the array if it's not empty.
            if (itemSchema && value.length > 0) {
                for (let i = 0; i < value.length; i++) {
                    check(value[i], itemSchema as CustomSchema, `${fullPath}[${i}]`);
                }
            }
        }
      }
    }
  }

  check(data, schema);
  
  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields,
  };
};