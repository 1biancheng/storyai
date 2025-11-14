"""
Template System with Plot Formulas Based on Star Logic
Advanced Novel Generation Templates
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Set, Any
from dataclasses import dataclass, field
from enum import Enum
import json
import random
from datetime import datetime
import re
from abc import ABC, abstractmethod

class PlotFormulaType(Enum):
    """Types of plot formulas based on Star logic"""
    THREE_ACT_STRUCTURE = "three_act_structure"
    HERO_JOURNEY = "hero_journey"
    ROMANCE_ARC = "romance_arc"
    MYSTERY_DETECTION = "mystery_detection"
    CONFLICT_RESOLUTION = "conflict_resolution"
    CHARACTER_GROWTH = "character_growth"
    ENVIRONMENTAL_ADAPTATION = "environmental_adaptation"
    EMOTIONAL_EVOLUTION = "emotional_evolution"

class TemplateComplexity(Enum):
    """Complexity levels for templates"""
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"
    ADVANCED = "advanced"

class NarrativeStyle(Enum):
    """Narrative style options"""
    LINEAR = "linear"
    NON_LINEAR = "non_linear"
    MULTI_PERSPECTIVE = "multi_perspective"
    STREAM_OF_CONSCIOUSNESS = "stream_of_consciousness"
    FLASHBACK_HEAVY = "flashback_heavy"

@dataclass
class PlotPoint:
    """Individual plot point with Star characteristics"""
    id: str
    name: str
    description: str
    position: float  # 0.0 to 1.0 position in story
    emotional_intensity: float  # 0.0 to 1.0
    conflict_level: float  # 0.0 to 1.0
    character_change: float  # 0.0 to 1.0
    star_features: Dict[str, Any]  # Star-specific features
    required_elements: List[str]  # Required story elements
    optional_elements: List[str]  # Optional story elements
    transition_rules: List[str]  # Rules for transitioning to next point
    backtrack_probability: float  # Probability of backtracking (Star feature)
    evolution_triggers: List[str]  # Triggers for story evolution

@dataclass
class StarFieldMapping:
    """Star field mapping for automatic generation"""
    field_name: str
    field_type: str  # "explicit", "implicit", "composite"
    extraction_pattern: str  # Regex pattern for extraction
    generation_rules: List[str]  # Rules for generating this field
    weight: float  # Importance weight (0.0 to 1.0)
    dependencies: List[str]  # Dependencies on other fields
    validation_rules: List[str]  # Validation rules
    evolution_factor: float  # How this field evolves over time

@dataclass
class TemplateConfiguration:
    """Configuration for novel generation template"""
    template_id: str
    name: str
    description: str
    formula_type: PlotFormulaType
    complexity: TemplateComplexity
    narrative_style: NarrativeStyle
    plot_points: List[PlotPoint]
    field_mappings: List[StarFieldMapping]
    star_parameters: Dict[str, Any]  # Star-specific parameters
    generation_constraints: Dict[str, Any]  # Constraints for generation
    quality_thresholds: Dict[str, float]  # Quality thresholds
    evolution_rules: Dict[str, Any]  # Rules for story evolution

class StarPlotFormulaEngine:
    """Advanced plot formula engine based on Star logic"""
    
    def __init__(self):
        self.formulas = {}
        self.field_mappings = {}
        self.star_rules = self._initialize_star_rules()
        self.template_cache = {}
        self.evolution_history = []
        
        # Initialize default formulas
        self._initialize_default_formulas()
    
    def _initialize_star_rules(self) -> Dict[str, Any]:
        """Initialize Star-specific rules and patterns"""
        return {
            "symbol_value_calculation_rules": {
                "explicit_symbol_weight": 0.4,
        "implicit_symbol_weight": 0.35,
        "composite_label_weight": 0.25,
                "dynamic_adjustment_factor": 0.1
            },
            "字段拼凑规则": {
                "动作描写": {
                    "显性模式": ["猛地{verb}", "突然{verb}", "缓缓{verb}"],
                    "隐性模式": ["眼神{emotion}", "表情{emotion}", "姿态{emotion}"],
                    "复合模式": ["虽然{action}但是{emotion}", "一边{action}一边{emotion}"]
                },
                "情感描写": {
                    "显性模式": ["{emotion}得{degree}", "感到{emotion}", "充满{emotion}"],
                    "隐性模式": ["心中{emotion}", "眼底{emotion}", "嘴角{emotion}"],
                    "复合模式": ["不是{emotion}而是{emotion}", "既{emotion}又{emotion}"]
                },
                "环境描写": {
                    "显性模式": ["{weather}的天气", "{environment}的环境", "{atmosphere}的氛围"],
                    "隐性模式": ["空气中{feeling}", "阳光中{mood}", "风中{emotion}"],
                    "复合模式": ["虽然{weather}但是{mood}", "尽管{environment}仍然{emotion}"]
                }
            },
            "演化逻辑规则": {
                "reader_perception_threshold": {
                    "情感变化阈值": 0.3,
                    "情节转折阈值": 0.4,
                    "风格变化阈值": 0.2,
                    "节奏变化阈值": 0.25
                },
                "反向修正机制": {
                    "过度显性修正": -0.15,
                    "过度隐性修正": -0.1,
                    "composite_label_imbalance_correction": -0.2,
                    "读者疲劳修正": -0.25
                },
                "演化速率控制": {
                    "快速演化": 0.8,
                    "中速演化": 0.5,
                    "慢速演化": 0.2,
                    "自适应演化": "dynamic"
                }
            },
            "质量控制规则": {
                "最低质量阈值": 0.6,
                "多样性要求": 0.3,
                "连贯性要求": 0.7,
                "创新性要求": 0.4
            }
        }
    
    def _initialize_default_formulas(self):
        """Initialize default plot formulas"""
        # Three Act Structure with Star characteristics
        three_act_template = self._create_three_act_template()
        self.register_formula("three_act_star", three_act_template)
        
        # Hero's Journey with Star evolution
        hero_journey_template = self._create_hero_journey_template()
        self.register_formula("hero_journey_star", hero_journey_template)
        
        # Romance Arc with emotional evolution
        romance_template = self._create_romance_template()
        self.register_formula("romance_star", romance_template)
        
        # Mystery Detection with clue progression
        mystery_template = self._create_mystery_template()
        self.register_formula("mystery_star", mystery_template)
    
    def _create_three_act_template(self) -> TemplateConfiguration:
        """Create Three Act Structure template with Star logic"""
        plot_points = [
            PlotPoint(
                id="act1_setup",
                name="第一幕:设定",
                description="建立故事世界、角色和初始冲突",
                position=0.15,
                emotional_intensity=0.3,
                conflict_level=0.2,
                character_change=0.1,
                star_features={
                    "explicit_symbols": ["阳光明媚的早晨", "熙熙攘攘的街道"],
                    "implicit_symbols": ["主角眼中闪过一丝忧郁", "空气中弥漫着紧张的气息"],
                    "composite_labels": ["虽然生活平静但是内心不安"]
                },
                required_elements=["主角介绍", "世界设定", "初始冲突"],
                optional_elements=["配角介绍", "背景故事"],
                transition_rules=["情感逐渐升温", "冲突逐步显现"],
                backtrack_probability=0.1,
                evolution_triggers=["主角遇到挑战", "世界发生变化"]
            ),
            PlotPoint(
                id="act1_inciting",
                name="激励事件",
                description="打破现状的重大事件",
                position=0.25,
                emotional_intensity=0.6,
                conflict_level=0.7,
                character_change=0.3,
                star_features={
                    "explicit_symbols": ["突然传来的消息", "意外的相遇"],
                    "implicit_symbols": ["主角心跳加速", "手心微微出汗"],
                    "composite_labels": ["尽管害怕但是必须面对"]
                },
                required_elements=["重大事件", "主角决定", "新目标"],
                optional_elements=["盟友出现", "敌人现身"],
                transition_rules=["情感急剧上升", "冲突全面爆发"],
                backtrack_probability=0.3,
                evolution_triggers=["主角做出选择", "世界规则改变"]
            ),
            PlotPoint(
                id="act2_confrontation",
                name="第二幕:对抗",
                description="主角面对挑战,冲突升级",
                position=0.5,
                emotional_intensity=0.8,
                conflict_level=0.9,
                character_change=0.6,
                star_features={
                    "explicit_symbols": ["激烈的争论", "危险的冒险"],
                    "implicit_symbols": ["内心挣扎加剧", "关系微妙变化"],
                    "composite_labels": ["一方面想要放弃另一方面必须坚持"]
                },
                required_elements=["主要冲突", "角色成长", "挫折失败"],
                optional_elements=["新盟友", "背叛事件"],
                transition_rules=["情感达到高潮", "冲突白热化"],
                backtrack_probability=0.4,
                evolution_triggers=["重大挫折", "关键发现"]
            ),
            PlotPoint(
                id="act2_dark_moment",
                name="至暗时刻",
                description="主角面临最大挑战",
                position=0.75,
                emotional_intensity=1.0,
                conflict_level=1.0,
                character_change=0.8,
                star_features={
                    "explicit_symbols": ["彻底的失败", "绝望的处境"],
                    "implicit_symbols": ["内心崩溃", "希望破灭"],
                    "composite_labels": ["不是选择放弃就是选择死亡"]
                },
                required_elements=["最大挫折", "内心崩溃", "重新思考"],
                optional_elements=["盟友牺牲", "真相揭露"],
                transition_rules=["情感跌入谷底", "冲突达到顶点"],
                backtrack_probability=0.5,
                evolution_triggers=["主角觉醒", "获得新力量"]
            ),
            PlotPoint(
                id="act3_climax",
                name="第三幕:高潮",
                description="最终对决,解决冲突",
                position=0.9,
                emotional_intensity=0.9,
                conflict_level=0.95,
                character_change=1.0,
                star_features={
                    "explicit_symbols": ["最终决战", "生死对决"],
                    "implicit_symbols": ["内心平静", "觉悟提升"],
                    "composite_labels": ["即使失败也要坚持到底"]
                },
                required_elements=["最终冲突", "角色成长完成", "主要问题解决"],
                optional_elements=["意外转折", "牺牲奉献"],
                transition_rules=["情感最终释放", "冲突得到解决"],
                backtrack_probability=0.2,
                evolution_triggers=["最终胜利", "获得新理解"]
            ),
            PlotPoint(
                id="act3_resolution",
                name="结局",
                description="故事收尾,展示结果",
                position=1.0,
                emotional_intensity=0.4,
                conflict_level=0.1,
                character_change=0.9,
                star_features={
                    "explicit_symbols": ["和平的景象", "幸福的结局"],
                    "implicit_symbols": ["内心的成长", "智慧的获得"],
                    "composite_labels": ["虽然经历风雨但是见到彩虹"]
                },
                required_elements=["冲突解决", "角色状态", "世界变化"],
                optional_elements=["未来展望", "新开始"],
                transition_rules=["情感回归平静", "世界恢复平衡"],
                backtrack_probability=0.05,
                evolution_triggers=["新的开始", "留下悬念"]
            )
        ]
        
        # Star field mappings for automatic generation
        field_mappings = [
            StarFieldMapping(
                field_name="action_description",
                field_type="explicit",
                extraction_pattern=r"(猛地|突然|迅速|缓缓|慢慢|轻轻|重重){verb}",
                generation_rules=["explicit_mode:{adverb}{verb}", "implicit_mode:眼神{emotion}", "composite_mode:虽然{action}但是{emotion}"],
                weight=0.3,
                dependencies=["character_emotion", "environment"],
                validation_rules=["动作合理性检查", "情感一致性检查"],
                evolution_factor=0.15
            ),
            StarFieldMapping(
                field_name="character_emotion",
                field_type="implicit",
                extraction_pattern=r"眼神(闪烁|黯淡|明亮)|表情(复杂|简单|丰富)",
                generation_rules=["explicit_mode:{emotion}得{degree}", "implicit_mode:心中{emotion}", "composite_mode:不是{emotion}而是{emotion}"],
                weight=0.4,
                dependencies=["plot_progression", "character_arc"],
                validation_rules=["情感逻辑检查", "角色一致性检查"],
                evolution_factor=0.2
            ),
            StarFieldMapping(
                field_name="environment_atmosphere",
                field_type="composite",
                extraction_pattern=r"虽然{weather}但是{mood}|尽管{environment}仍然{emotion}",
                generation_rules=["explicit_mode:{weather}的天气", "implicit_mode:空气中{feeling}", "composite_mode:虽然{weather}但是{mood}"],
                weight=0.3,
                dependencies=["character_emotion", "plot_tension"],
                validation_rules=["环境一致性检查", "氛围协调性检查"],
                evolution_factor=0.1
            )
        ]
        
        return TemplateConfiguration(
            template_id="three_act_star",
            name="三幕结构(Star版)",
            description="基于Star逻辑的三幕结构模板,包含explicit_symbols、implicit_symbols和composite_labels",
            formula_type=PlotFormulaType.THREE_ACT_STRUCTURE,
            complexity=TemplateComplexity.COMPLEX,
            narrative_style=NarrativeStyle.LINEAR,
            plot_points=plot_points,
            field_mappings=field_mappings,
            star_parameters={
                "symbol_weights": {"explicit": 0.4, "implicit": 0.35, "composite": 0.25},
                "evolution_rate": "medium",
                "reader_perception_threshold": 0.3,
                "反向修正强度": 0.15
            },
            generation_constraints={
                "最小段落数": 50,
                "最大段落数": 200,
                "情感强度变化": "渐进式",
                "冲突升级模式": "螺旋式"
            },
            quality_thresholds={
                "最低质量分数": 0.7,
                "连贯性要求": 0.8,
                "创新性要求": 0.5,
                "读者参与度": 0.6
            },
            evolution_rules={
                "演化触发条件": ["读者反馈低于阈值", "质量检测失败"],
                "演化方向": ["增加显性符号", "增强复合标签", "调整情感节奏"],
                "演化限制": ["保持核心情节", "维护角色一致性"]
            }
        )
    
    def _create_hero_journey_template(self) -> TemplateConfiguration:
        """Create Hero's Journey template with Star evolution"""
        plot_points = [
            PlotPoint(
                id="ordinary_world",
                name="平凡世界",
                description="主角的日常生活",
                position=0.1,
                emotional_intensity=0.2,
                conflict_level=0.1,
                character_change=0.0,
                star_features={
                    "显性符号": ["平凡的小镇", "普通的家庭"],
                    "隐性符号": ["内心的渴望", "不满足现状"],
                    "复合标签": ["虽然生活安稳但是内心空虚"]
                },
                required_elements=["主角介绍", "日常生活", "内心渴望"],
                optional_elements=["配角介绍", "世界规则"],
                transition_rules=["平静中孕育变化"],
                backtrack_probability=0.05,
                evolution_triggers=["遇到召唤"]
            ),
            PlotPoint(
                id="call_to_adventure",
                name="冒险召唤",
                description="主角收到冒险的召唤",
                position=0.2,
                emotional_intensity=0.5,
                conflict_level=0.4,
                character_change=0.2,
                star_features={
                    "显性符号": ["神秘的邀请", "意外的消息"],
                    "隐性符号": ["心跳加速", "眼神闪烁"],
                    "复合标签": ["既害怕又兴奋"]
                },
                required_elements=["召唤事件", "主角犹豫", "最终接受"],
                optional_elements=["导师出现", "获得礼物"],
                transition_rules=["情感开始波动"],
                backtrack_probability=0.2,
                evolution_triggers=["接受召唤"]
            ),
            PlotPoint(
                id="supreme_ordeal",
                name="严峻考验",
                description="主角面临生死考验",
                position=0.8,
                emotional_intensity=1.0,
                conflict_level=1.0,
                character_change=0.9,
                star_features={
                    "显性符号": ["生死对决", "极限挑战"],
                    "隐性符号": ["内心恐惧", "自我怀疑"],
                    "复合标签": ["不是生就是死"]
                },
                required_elements=["最大挑战", "内心恐惧", "克服障碍"],
                optional_elements=["盟友牺牲", "获得启示"],
                transition_rules=["情感达到顶点"],
                backtrack_probability=0.3,
                evolution_triggers=["战胜考验"]
            )
        ]
        
        # Add more plot points for complete hero's journey
        additional_points = [
            PlotPoint(
                id="refusal_call",
                name="拒绝召唤",
                position=0.15,
                emotional_intensity=0.3,
                conflict_level=0.3,
                character_change=0.1,
                star_features={"复合标签": ["虽然想要冒险但是害怕危险"]},
                required_elements=["拒绝理由", "内心挣扎"],
                optional_elements=[], transition_rules=["情感矛盾"],
                backtrack_probability=0.15, evolution_triggers=["重新考虑"]
            ),
            PlotPoint(
                id="meeting_mentor",
                name="遇见导师",
                position=0.25,
                emotional_intensity=0.4,
                conflict_level=0.2,
                character_change=0.3,
                star_features={"隐性符号": ["智慧的眼神", "温和的笑容"]},
                required_elements=["导师介绍", "获得指导"],
                optional_elements=["获得礼物"], transition_rules=["获得信心"],
                backtrack_probability=0.1, evolution_triggers=["学会技能"]
            ),
            PlotPoint(
                id="crossing_threshold",
                name="跨越门槛",
                position=0.3,
                emotional_intensity=0.6,
                conflict_level=0.5,
                character_change=0.4,
                star_features={"显性符号": ["跨越边界", "进入新世界"]},
                required_elements=["离开舒适区", "进入新世界"],
                optional_elements=["遇到挑战"], transition_rules=["正式开始冒险"],
                backtrack_probability=0.25, evolution_triggers=["适应新环境"]
            ),
            PlotPoint(
                id="tests_allies_enemies",
                name="考验、盟友、敌人",
                position=0.4,
                emotional_intensity=0.7,
                conflict_level=0.7,
                character_change=0.5,
                star_features={"复合标签": ["一边学习一边成长"]},
                required_elements=["遇到挑战", "结识盟友", "面对敌人"],
                optional_elements=["学会技能"], transition_rules=["能力增强"],
                backtrack_probability=0.3, evolution_triggers=["团队形成"]
            ),
            PlotPoint(
                id="approach_inmost_cave",
                name="接近最深洞穴",
                position=0.6,
                emotional_intensity=0.8,
                conflict_level=0.8,
                character_change=0.7,
                star_features={"隐性符号": ["紧张气氛", "不祥预感"]},
                required_elements=["接近目标", "感到恐惧"],
                optional_elements=["制定计划"], transition_rules=["紧张感增加"],
                backtrack_probability=0.35, evolution_triggers=["准备最终挑战"]
            ),
            PlotPoint(
                id="reward",
                name="获得奖励",
                position=0.85,
                emotional_intensity=0.7,
                conflict_level=0.3,
                character_change=0.95,
                star_features={"显性符号": ["获得宝物", "掌握力量"]},
                required_elements=["获得奖励", "庆祝胜利"],
                optional_elements=["获得智慧"], transition_rules=["情感释放"],
                backtrack_probability=0.15, evolution_triggers=["准备回归"]
            ),
            PlotPoint(
                id="road_back",
                name="回归之路",
                position=0.9,
                emotional_intensity=0.6,
                conflict_level=0.6,
                character_change=0.9,
                star_features={"复合标签": ["虽然获得奖励但是还要面对挑战"]},
                required_elements=["开始回归", "面临新挑战"],
                optional_elements=["保护奖励"], transition_rules=["情感复杂化"],
                backtrack_probability=0.2, evolution_triggers=["最后挑战"]
            ),
            PlotPoint(
                id="resurrection",
                name="复活",
                position=0.95,
                emotional_intensity=0.8,
                conflict_level=0.7,
                character_change=1.0,
                star_features={"隐性符号": ["内心蜕变", "智慧获得"]},
                required_elements=["最后考验", "最终改变"],
                optional_elements=["牺牲奉献"], transition_rules=["完成蜕变"],
                backtrack_probability=0.1, evolution_triggers=["成为英雄"]
            ),
            PlotPoint(
                id="return_elixir",
                name="带着仙丹回归",
                position=1.0,
                emotional_intensity=0.5,
                conflict_level=0.1,
                character_change=1.0,
                star_features={"显性符号": ["回到故乡", "分享成果"]},
                required_elements=["回归平凡世界", "分享所学"],
                optional_elements=["开始新循环"], transition_rules=["情感回归平静"],
                backtrack_probability=0.05, evolution_triggers=["新的开始"]
            )
        ]
        
        plot_points.extend(additional_points)
        
        return TemplateConfiguration(
            template_id="hero_journey_star",
            name="英雄之旅(Star版)",
            description="基于Star逻辑的英雄之旅模板,强调角色内心变化和情感演化",
            formula_type=PlotFormulaType.HERO_JOURNEY,
            complexity=TemplateComplexity.ADVANCED,
            narrative_style=NarrativeStyle.LINEAR,
            plot_points=plot_points,
            field_mappings=self._create_hero_journey_field_mappings(),
            star_parameters={
                "symbol_weights": {"explicit": 0.35, "implicit": 0.4, "composite": 0.25},
                "evolution_rate": "slow",
                "reader_perception_threshold": 0.25,
                "反向修正强度": 0.2
            },
            generation_constraints={
                "最小段落数": 80,
                "最大段落数": 300,
                "情感强度变化": "渐进式",
                "角色成长模式": "螺旋上升式"
            },
            quality_thresholds={
                "最低质量分数": 0.75,
                "连贯性要求": 0.85,
                "创新性要求": 0.6,
                "角色一致性": 0.9
            },
            evolution_rules={
                "演化触发条件": ["角色成长停滞", "情感变化不自然"],
                "演化方向": ["增强内心描写", "调整成长节奏"],
                "演化限制": ["保持英雄之旅结构", "维护角色核心特征"]
            }
        )
    
    def _create_hero_journey_field_mappings(self) -> List[StarFieldMapping]:
        """Create field mappings for hero's journey"""
        return [
            StarFieldMapping(
                field_name="hero_transformation",
                field_type="composite",
                extraction_pattern=r"内心.*变化|性格.*转变|思想.*成熟",
                generation_rules=[
                    "显性模式:从{old_trait}变成{new_trait}",
                    "隐性模式:内心逐渐{emotion}",
                    "复合模式:虽然外表{appearance}但是内心{inner_change}"
                ],
                weight=0.5,
                dependencies=["plot_progression", "character_arc"],
                validation_rules=["转变合理性检查", "过程自然性检查"],
                evolution_factor=0.25
            ),
            StarFieldMapping(
                field_name="mentor_guidance",
                field_type="implicit",
                extraction_pattern=r"导师.*指导|智慧.*传授|经验.*分享",
                generation_rules=[
                    "显性模式:导师说:{wisdom}",
                    "隐性模式:眼神中流露出{wisdom}",
                    "复合模式:不是直接告诉{lesson}而是通过{method}让主角领悟"
                ],
                weight=0.3,
                dependencies=["mentor_character", "hero_readiness"],
                validation_rules=["导师形象一致性", "指导方式合理性"],
                evolution_factor=0.15
            ),
            StarFieldMapping(
                field_name="threshold_crossing",
                field_type="explicit",
                extraction_pattern=r"跨越.*门槛|进入.*新.*世界|离开.*舒适区",
                generation_rules=[
                    "显性模式:主角跨过{boundary}",
                    "隐性模式:感到{emotion}的同时迈出了关键一步",
                    "复合模式:虽然{hesitation}但是还是{crossing_action}"
                ],
                weight=0.2,
                dependencies=["hero_decision", "threshold_event"],
                validation_rules=["跨越意义明确性", "情感变化合理性"],
                evolution_factor=0.1
            )
        ]
    
    def _create_romance_template(self) -> TemplateConfiguration:
        """Create Romance template with emotional evolution"""
        plot_points = [
            PlotPoint(
                id="first_meeting",
                name="初次相遇",
                position=0.1,
                emotional_intensity=0.3,
                conflict_level=0.1,
                character_change=0.1,
                star_features={
                    "显性符号": ["偶然的相遇", "意外的碰撞"],
                    "隐性符号": ["心跳漏了一拍", "眼神不自觉地被吸引"],
                    "复合标签": ["虽然只是擦肩而过但是留下了深刻的印象"]
                },
                required_elements=["相遇场景", "第一印象", "内心波动"],
                optional_elements=["尴尬事件", "误会开始"],
                transition_rules=["情感种子种下"],
                backtrack_probability=0.1,
                evolution_triggers=["再次相遇"]
            ),
            PlotPoint(
                id="attraction_growth",
                name="吸引力增长",
                position=0.3,
                emotional_intensity=0.6,
                conflict_level=0.3,
                character_change=0.4,
                star_features={
                    "显性符号": ["频繁相遇", "主动接近"],
                    "隐性符号": ["期待见面", "思念加剧"],
                    "复合标签": ["一方面想要保持距离另一方面又忍不住靠近"]
                },
                required_elements=["了解加深", "吸引力增强", "内心挣扎"],
                optional_elements=["共同经历", "互相帮助"],
                transition_rules=["情感逐步升温"],
                backtrack_probability=0.2,
                evolution_triggers=["感情确认"]
            ),
            PlotPoint(
                id="conflict_crisis",
                name="冲突危机",
                position=0.7,
                emotional_intensity=0.9,
                conflict_level=0.9,
                character_change=0.8,
                star_features={
                    "显性符号": ["激烈争吵", "伤心离别"],
                    "隐性符号": ["心如刀割", "泪如雨下"],
                    "复合标签": ["不是因为不爱了而是因为太爱了"]
                },
                required_elements=["重大冲突", "情感危机", "痛苦分离"],
                optional_elements=["第三者介入", "误会加深"],
                transition_rules=["情感达到痛苦顶点"],
                backtrack_probability=0.4,
                evolution_triggers=["问题解决"]
            ),
            PlotPoint(
                id="reunion_resolution",
                name="重聚解决",
                position=1.0,
                emotional_intensity=0.8,
                conflict_level=0.2,
                character_change=0.9,
                star_features={
                    "显性符号": ["深情拥抱", "真挚告白"],
                    "隐性符号": ["内心圆满", "情感升华"],
                    "复合标签": ["经历了风雨之后终于见到了彩虹"]
                },
                required_elements=["问题解决", "情感确认", "美好结局"],
                optional_elements=["浪漫求婚", "未来规划"],
                transition_rules=["情感得到圆满"],
                backtrack_probability=0.05,
                evolution_triggers=["新的开始"]
            )
        ]
        
        return TemplateConfiguration(
            template_id="romance_star",
            name="浪漫爱情(Star版)",
            description="基于Star逻辑的浪漫爱情模板,注重情感细腻变化和内心描写",
            formula_type=PlotFormulaType.ROMANCE_ARC,
            complexity=TemplateComplexity.MEDIUM,
            narrative_style=NarrativeStyle.LINEAR,
            plot_points=plot_points,
            field_mappings=self._create_romance_field_mappings(),
            star_parameters={
                "symbol_weights": {"explicit": 0.3, "implicit": 0.5, "composite": 0.2},
                "evolution_rate": "medium",
                "reader_perception_threshold": 0.2,
                "反向修正强度": 0.1
            },
            generation_constraints={
                "最小段落数": 40,
                "最大段落数": 150,
                "情感强度变化": "波浪式",
                "冲突解决模式": "情感化解式"
            },
            quality_thresholds={
                "最低质量分数": 0.7,
                "连贯性要求": 0.8,
                "情感真实性": 0.85,
                "角色化学反应": 0.9
            },
            evolution_rules={
                "演化触发条件": ["情感变化不自然", "冲突解决过于简单"],
                "演化方向": ["增强内心描写", "丰富情感层次"],
                "演化限制": ["保持爱情主线", "维护角色魅力"]
            }
        )
    
    def _create_romance_field_mappings(self) -> List[StarFieldMapping]:
        """Create field mappings for romance"""
        return [
            StarFieldMapping(
                field_name="emotional_progression",
                field_type="composite",
                extraction_pattern=r"感情.*发展|情感.*变化|爱意.*增长",
                generation_rules=[
                    "显性模式:{emotion}越来越{degree}",
                    "隐性模式:内心的{emotion}在悄悄{change}",
                    "复合模式:虽然{resistance}但是{emotion}还是{growth}"
                ],
                weight=0.6,
                dependencies=["character_interaction", "time_progression"],
                validation_rules=["情感发展合理性", "变化节奏自然性"],
                evolution_factor=0.3
            ),
            StarFieldMapping(
                field_name="romantic_tension",
                field_type="implicit",
                extraction_pattern=r"暧昧.*气氛|紧张.*关系|吸引力.*增强",
                generation_rules=[
                    "显性模式:两人之间的{tension}越来越明显",
                    "隐性模式:空气中弥漫着{atmosphere}",
                    "复合模式:不是{direct_expression}而是通过{subtle_signal}表达"
                ],
                weight=0.3,
                dependencies=["emotional_progression", "physical_proximity"],
                validation_rules=["紧张感适度性", "表达方式合理性"],
                evolution_factor=0.2
            ),
            StarFieldMapping(
                field_name="conflict_resolution",
                field_type="explicit",
                extraction_pattern=r"冲突.*解决|误会.*消除|和解.*达成",
                generation_rules=[
                    "显性模式:通过{action}解决了{problem}",
                    "隐性模式:{emotion}的变化让{conflict}自然化解",
                    "复合模式:虽然{obstacle}但是通过{method}最终{resolution}"
                ],
                weight=0.1,
                dependencies=["conflict_nature", "character_growth"],
                validation_rules=["解决方式合理性", "情感转变自然性"],
                evolution_factor=0.15
            )
        ]
    
    def _create_mystery_template(self) -> TemplateConfiguration:
        """Create Mystery Detection template with clue progression"""
        plot_points = [
            PlotPoint(
                id="crime_discovery",
                name="发现罪案",
                position=0.1,
                emotional_intensity=0.4,
                conflict_level=0.3,
                character_change=0.1,
                star_features={
                    "显性符号": ["发现尸体", "看到血迹"],
                    "隐性符号": ["不祥预感", "紧张气氛"],
                    "复合标签": ["虽然表面平静但是隐藏着秘密"]
                },
                required_elements=["犯罪现场", "初步线索", "侦探介入"],
                optional_elements=["嫌疑人出现", "动机暗示"],
                transition_rules=["悬念建立"],
                backtrack_probability=0.1,
                evolution_triggers=["发现新线索"]
            ),
            PlotPoint(
                id="investigation_deepening",
                name="调查深入",
                position=0.4,
                emotional_intensity=0.6,
                conflict_level=0.6,
                character_change=0.3,
                star_features={
                    "显性符号": ["找到证据", "询问证人"],
                    "隐性符号": ["证词矛盾", "表情可疑"],
                    "复合标签": ["一方面相信证词另一方面又感到怀疑"]
                },
                required_elements=["收集证据", "询问证人", "分析线索"],
                optional_elements=["嫌疑人增多", "动机复杂化"],
                transition_rules=["谜团加深"],
                backtrack_probability=0.3,
                evolution_triggers=["发现矛盾"]
            ),
            PlotPoint(
                id="breakthrough_moment",
                name="突破时刻",
                position=0.7,
                emotional_intensity=0.8,
                conflict_level=0.8,
                character_change=0.6,
                star_features={
                    "显性符号": ["关键发现", "重要证据"],
                    "隐性符号": ["灵光一闪", "突然明白"],
                    "复合标签": ["虽然不是直接证据但是能够推断出真相"]
                },
                required_elements=["关键发现", "推理过程", "真相接近"],
                optional_elements=["嫌疑人排除", "真凶暗示"],
                transition_rules=["接近真相"],
                backtrack_probability=0.2,
                evolution_triggers=["获得关键证据"]
            ),
            PlotPoint(
                id="truth_revelation",
                name="真相大白",
                position=1.0,
                emotional_intensity=0.9,
                conflict_level=0.9,
                character_change=0.8,
                star_features={
                    "显性符号": ["凶手认罪", "证据确凿"],
                    "隐性符号": ["侦探的满足", "正义得到伸张"],
                    "复合标签": ["不仅解决了案件而且获得了成长"]
                },
                required_elements=["真相揭露", "凶手身份", "动机解释"],
                optional_elements=["凶手忏悔", "意外真相"],
                transition_rules=["案件解决"],
                backtrack_probability=0.05,
                evolution_triggers=["案件结束"]
            )
        ]
        
        return TemplateConfiguration(
            template_id="mystery_star",
            name="悬疑推理(Star版)",
            description="基于Star逻辑的悬疑推理模板,注重线索递进和推理过程",
            formula_type=PlotFormulaType.MYSTERY_DETECTION,
            complexity=TemplateComplexity.COMPLEX,
            narrative_style=NarrativeStyle.NON_LINEAR,
            plot_points=plot_points,
            field_mappings=self._create_mystery_field_mappings(),
            star_parameters={
                "symbol_weights": {"explicit": 0.5, "implicit": 0.3, "composite": 0.2},
                "evolution_rate": "fast",
                "reader_perception_threshold": 0.35,
                "反向修正强度": 0.2
            },
            generation_constraints={
                "最小段落数": 60,
                "最大段落数": 200,
                "线索密度": "高密度",
                "推理复杂度": "多层次"
            },
            quality_thresholds={
                "最低质量分数": 0.8,
                "逻辑严密性": 0.9,
                "线索合理性": 0.85,
                "推理可信度": 0.88
            },
            evolution_rules={
                "演化触发条件": ["线索过于明显", "推理跳跃过大"],
                "演化方向": ["增加误导线索", "强化推理逻辑"],
                "演化限制": ["保持真相不变", "维护侦探形象"]
            }
        )
    
    def _create_mystery_field_mappings(self) -> List[StarFieldMapping]:
        """Create field mappings for mystery"""
        return [
            StarFieldMapping(
                field_name="clue_progression",
                field_type="explicit",
                extraction_pattern=r"线索.*发现|证据.*收集|信息.*获取",
                generation_rules=[
                    "显性模式:发现了{clue_type}的{clue_content}",
                    "隐性模式:{observation}中暗示着{implication}",
                    "复合模式:虽然不是{direct_clue}但是通过{indirect_evidence}可以推断"
                ],
                weight=0.4,
                dependencies=["investigation_progress", "detective_insight"],
                validation_rules=["线索逻辑性", "递进合理性"],
                evolution_factor=0.25
            ),
            StarFieldMapping(
                field_name="suspense_maintaining",
                field_type="implicit",
                extraction_pattern=r"悬念.*维持|紧张.*气氛|神秘.*感",
                generation_rules=[
                    "显性模式:{suspense_element}让案件更加扑朔迷离",
                    "隐性模式:{atmosphere}中透露着{unease}",
                    "复合模式:不是{obvious_answer}而是{mysterious_aspect}保持了悬念"
                ],
                weight=0.3,
                dependencies=["clue_progression", "reader_engagement"],
                validation_rules=["悬念适度性", "读者参与度"],
                evolution_factor=0.2
            ),
            StarFieldMapping(
                field_name="reasoning_process",
                field_type="composite",
                extraction_pattern=r"推理.*过程|逻辑.*分析|思考.*过程",
                generation_rules=[
                    "显性模式:通过{evidence}可以得出{conclusion}",
                    "隐性模式:{detective_thought}的过程中逐渐{realization}",
                    "复合模式:虽然{contradiction}但是通过{analysis}最终{resolution}"
                ],
                weight=0.3,
                dependencies=["clue_progression", "suspense_maintaining"],
                validation_rules=["推理严密性", "逻辑连贯性"],
                evolution_factor=0.15
            )
        ]
    
    def register_formula(self, formula_id: str, template: TemplateConfiguration):
        """Register a new plot formula"""
        self.formulas[formula_id] = template
        self.template_cache[formula_id] = {
            "usage_count": 0,
            "average_quality": 0.0,
            "last_used": None,
            "evolution_history": []
        }
    
    def generate_story_outline(self, formula_id: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generate story outline using specified formula"""
        if formula_id not in self.formulas:
            raise ValueError(f"Formula {formula_id} not found")
        
        template = self.formulas[formula_id]
        
        # Apply Star evolution based on history
        evolved_template = self._apply_star_evolution(template)
        
        # Generate outline based on plot points
        outline = self._generate_outline_from_template(evolved_template, parameters)
        
        # Apply field mappings for automatic generation
        field_mappings = self._apply_field_mappings(evolved_template, outline)
        
        # Calculate quality metrics
        quality_metrics = self._calculate_outline_quality(outline, evolved_template)
        
        # Update template cache
        self._update_template_cache(formula_id, quality_metrics)
        
        return {
            "outline": outline,
            "field_mappings": field_mappings,
            "quality_metrics": quality_metrics,
            "star_features": evolved_template.star_parameters,
            "evolution_applied": True
        }
    
    def _apply_star_evolution(self, template: TemplateConfiguration) -> TemplateConfiguration:
        """Apply Star evolution to template based on history"""
        # This is a simplified implementation
        # In practice, this would involve complex ML models and historical analysis
        
        evolution_factor = self._calculate_evolution_factor(template)
        
        # Evolve plot points
        evolved_points = []
        for point in template.plot_points:
            evolved_point = self._evolve_plot_point(point, evolution_factor)
            evolved_points.append(evolved_point)
        
        # Evolve field mappings
        evolved_mappings = []
        for mapping in template.field_mappings:
            evolved_mapping = self._evolve_field_mapping(mapping, evolution_factor)
            evolved_mappings.append(evolved_mapping)
        
        # Create evolved template
        evolved_template = TemplateConfiguration(
            template_id=template.template_id + "_evolved",
            name=template.name + "(演化版)",
            description=template.description + " 经过星矢演化优化",
            formula_type=template.formula_type,
            complexity=template.complexity,
            narrative_style=template.narrative_style,
            plot_points=evolved_points,
            field_mappings=evolved_mappings,
            star_parameters=self._evolve_star_parameters(template.star_parameters, evolution_factor),
            generation_constraints=template.generation_constraints,
            quality_thresholds=template.quality_thresholds,
            evolution_rules=template.evolution_rules
        )
        
        return evolved_template
    
    def _calculate_evolution_factor(self, template: TemplateConfiguration) -> float:
        """Calculate evolution factor based on template history"""
        # Simple implementation - in practice would use ML models
        cache_info = self.template_cache.get(template.template_id, {})
        usage_count = cache_info.get("usage_count", 0)
        avg_quality = cache_info.get("average_quality", 0.5)
        
        # Higher usage and lower quality trigger more evolution
        evolution_factor = (usage_count * 0.01) + (1 - avg_quality) * 0.5
        return min(evolution_factor, 1.0)
    
    def _evolve_plot_point(self, point: PlotPoint, evolution_factor: float) -> PlotPoint:
        """Evolve individual plot point"""
        # Apply evolution to emotional intensity and conflict level
        new_emotional_intensity = min(point.emotional_intensity * (1 + evolution_factor * 0.2), 1.0)
        new_conflict_level = min(point.conflict_level * (1 + evolution_factor * 0.15), 1.0)
        new_character_change = min(point.character_change * (1 + evolution_factor * 0.1), 1.0)
        
        # Evolve Star features
        evolved_star_features = self._evolve_star_features(point.star_features, evolution_factor)
        
        return PlotPoint(
            id=point.id + "_evolved",
            name=point.name + "(演化)",
            description=point.description,
            position=point.position,
            emotional_intensity=new_emotional_intensity,
            conflict_level=new_conflict_level,
            character_change=new_character_change,
            star_features=evolved_star_features,
            required_elements=point.required_elements,
            optional_elements=point.optional_elements,
            transition_rules=point.transition_rules,
            backtrack_probability=point.backtrack_probability * (1 + evolution_factor * 0.1),
            evolution_triggers=point.evolution_triggers
        )
    
    def _evolve_star_features(self, features: Dict[str, Any], evolution_factor: float) -> Dict[str, Any]:
        """Evolve Star features"""
        evolved_features = features.copy()
        
        # Enhance explicit symbols
        if "显性符号" in evolved_features:
            evolved_features["显性符号"] = [
                symbol + "(增强)" for symbol in evolved_features["显性符号"]
            ]
        
        # Enhance implicit symbols
        if "隐性符号" in evolved_features:
            evolved_features["隐性符号"] = [
                symbol + "(深化)" for symbol in evolved_features["隐性符号"]
            ]
        
        # Enhance composite labels
        if "复合标签" in evolved_features:
            evolved_features["复合标签"] = [
                label + "(复杂化)" for label in evolved_features["复合标签"]
            ]
        
        return evolved_features
    
    def _evolve_field_mapping(self, mapping: StarFieldMapping, evolution_factor: float) -> StarFieldMapping:
        """Evolve field mapping"""
        return StarFieldMapping(
            field_name=mapping.field_name + "_evolved",
            field_type=mapping.field_type,
            extraction_pattern=mapping.extraction_pattern,
            generation_rules=[rule + "(演化版)" for rule in mapping.generation_rules],
            weight=min(mapping.weight * (1 + evolution_factor * 0.1), 1.0),
            dependencies=mapping.dependencies,
            validation_rules=mapping.validation_rules,
            evolution_factor=mapping.evolution_factor * (1 + evolution_factor * 0.2)
        )
    
    def _evolve_star_parameters(self, parameters: Dict[str, Any], evolution_factor: float) -> Dict[str, Any]:
        """Evolve Star parameters"""
        evolved_params = parameters.copy()
        
        # Adjust symbol weights
        if "symbol_weights" in evolved_params:
            weights = evolved_params["symbol_weights"]
            total_weight = sum(weights.values())
            for key in weights:
                weights[key] = weights[key] * (1 + random.uniform(-0.1, 0.1) * evolution_factor)
            
            # Normalize weights
            new_total = sum(weights.values())
            for key in weights:
                weights[key] = weights[key] / new_total * total_weight
        
        # Adjust other parameters
        if "reader_perception_threshold" in evolved_params:
            evolved_params["reader_perception_threshold"] = max(
                evolved_params["reader_perception_threshold"] * (1 - evolution_factor * 0.1), 0.1
            )
        
        return evolved_params
    
    def _generate_outline_from_template(self, template: TemplateConfiguration,
                                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generate story outline from template"""
        outline = {
            "template_id": template.template_id,
            "plot_points": [],
            "field_assignments": {},
            "story_segments": [],
            "character_arcs": [],
            "thematic_elements": []
        }
        
        # Generate plot point details
        for point in template.plot_points:
            point_detail = {
                "id": point.id,
                "name": point.name,
                "position": point.position,
                "emotional_intensity": point.emotional_intensity,
                "conflict_level": point.conflict_level,
                "character_change": point.character_change,
                "star_features": point.star_features,
                "content_outline": self._generate_point_content(point, parameters),
                "required_elements": point.required_elements,
                "transition_rules": point.transition_rules,
                "backtrack_probability": point.backtrack_probability
            }
            outline["plot_points"].append(point_detail)
        
        # Generate field assignments
        for mapping in template.field_mappings:
            field_assignment = self._generate_field_assignment(mapping, parameters)
            outline["field_assignments"][mapping.field_name] = field_assignment
        
        # Generate story segments
        outline["story_segments"] = self._generate_story_segments(template, parameters)
        
        return outline
    
    def _generate_point_content(self, point: PlotPoint, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generate content outline for a plot point"""
        return {
            "description": point.description,
            "key_scenes": self._generate_key_scenes(point, parameters),
            "emotional_arc": self._generate_emotional_arc(point),
            "star_elements": self._generate_star_elements(point),
            "character_moments": self._generate_character_moments(point),
            "transitional_elements": point.transition_rules
        }
    
    def _generate_key_scenes(self, point: PlotPoint, parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate key scenes for plot point"""
        scenes = []
        
        # Generate scenes based on required elements
        for element in point.required_elements:
            scene = {
                "purpose": element,
                "setting": self._generate_setting_for_element(element, parameters),
                "characters": self._generate_characters_for_element(element, parameters),
                "emotional_tone": self._generate_emotional_tone_for_element(element, point),
                "star_elements": self._generate_star_for_element(element, point)
            }
            scenes.append(scene)
        
        return scenes
    
    def _generate_emotional_arc(self, point: PlotPoint) -> Dict[str, Any]:
        """Generate emotional arc for plot point"""
        return {
            "starting_emotion": self._get_starting_emotion(point),
            "ending_emotion": self._get_ending_emotion(point),
            "emotional_peaks": self._identify_emotional_peaks(point),
            "emotional_transitions": self._generate_emotional_transitions(point)
        }
    
    def _generate_star_elements(self, point: PlotPoint) -> Dict[str, Any]:
        """Generate Star elements for plot point"""
        return {
            "explicit_symbols": point.star_features.get("显性符号", []),
            "implicit_symbols": point.star_features.get("隐性符号", []),
            "composite_labels": point.star_features.get("复合标签", []),
            "evolution_triggers": point.evolution_triggers,
            "backtrack_probability": point.backtrack_probability
        }
    
    def _apply_field_mappings(self, template: TemplateConfiguration,
                              outline: Dict[str, Any]) -> Dict[str, Any]:
        """Apply field mappings to generate specific content"""
        field_assignments = {}
        
        for mapping in template.field_mappings:
            assignment = self._generate_field_assignment(mapping, outline)
            field_assignments[mapping.field_name] = assignment
        
        return field_assignments
    
    def _generate_field_assignment(self, mapping: StarFieldMapping,
                                 context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate field assignment based on mapping rules"""
        return {
            "field_name": mapping.field_name,
            "field_type": mapping.field_type,
            "generated_content": self._generate_field_content(mapping, context),
            "extraction_pattern": mapping.extraction_pattern,
            "weight": mapping.weight,
            "dependencies_status": self._check_dependencies(mapping, context),
            "validation_result": self._validate_field_assignment(mapping, context)
        }
    
    def _calculate_outline_quality(self, outline: Dict[str, Any],
                                 template: TemplateConfiguration) -> Dict[str, Any]:
        """Calculate quality metrics for the outline"""
        return {
            "overall_quality": self._calculate_overall_quality(outline, template),
            "coherence_score": self._calculate_coherence(outline),
            "emotional_continuity": self._calculate_emotional_continuity(outline),
            "plot_consistency": self._calculate_plot_consistency(outline),
            "star_compliance": self._calculate_star_compliance(outline, template),
            "reader_engagement_prediction": self._predict_reader_engagement(outline)
        }
    
    def _update_template_cache(self, formula_id: str, quality_metrics: Dict[str, Any]):
        """Update template cache with usage information"""
        if formula_id not in self.template_cache:
            self.template_cache[formula_id] = {
                "usage_count": 0,
                "average_quality": 0.0,
                "last_used": None,
                "evolution_history": []
            }
        
        cache_entry = self.template_cache[formula_id]
        cache_entry["usage_count"] += 1
        cache_entry["last_used"] = datetime.now()
        
        # Update average quality
        current_avg = cache_entry["average_quality"]
        new_quality = quality_metrics["overall_quality"]
        cache_entry["average_quality"] = (
            (current_avg * (cache_entry["usage_count"] - 1) + new_quality) /
            cache_entry["usage_count"]
        )
        
        # Add to evolution history
        cache_entry["evolution_history"].append({
            "timestamp": datetime.now(),
            "quality": new_quality,
            "metrics": quality_metrics
        })
    
    # Helper methods for content generation
    def _generate_setting_for_element(self, element: str, parameters: Dict[str, Any]) -> str:
        """Generate setting for story element"""
        settings = {
            "主角介绍": "平凡的小镇街道",
            "日常生活": "温馨的家庭环境",
            "内心渴望": "安静的思考空间",
            "重大事件": "热闹的公共场所",
            "犯罪现场": "阴暗的犯罪现场",
            "侦探介入": "专业的调查环境"
        }
        return settings.get(element, "中性环境")
    
    def _generate_characters_for_element(self, element: str, parameters: Dict[str, Any]) -> List[str]:
        """Generate characters for story element"""
        characters = {
            "主角介绍": ["主角", "旁白"],
            "日常生活": ["主角", "家人", "邻居"],
            "内心渴望": ["主角", "内心声音"],
            "重大事件": ["主角", "关键人物", "旁观者"],
            "犯罪现场": ["侦探", "受害者", "嫌疑人"],
            "侦探介入": ["侦探", "助手", "相关人员"]
        }
        return characters.get(element, ["主角"])
    
    def _generate_emotional_tone_for_element(self, element: str, point: PlotPoint) -> str:
        """Generate emotional tone for story element"""
        base_intensity = point.emotional_intensity
        if "冲突" in element or "挑战" in element:
            return f"紧张({base_intensity:.1f})"
        elif "情感" in element or "内心" in element:
            return f"内省({base_intensity:.1f})"
        else:
            return f"中性({base_intensity * 0.5:.1f})"
    
    def _generate_star_for_element(self, element: str, point: PlotPoint) -> Dict[str, Any]:
        """Generate Star elements for story element"""
        return {
            "explicit_symbols": [f"{element}的显性表现"],
            "implicit_symbols": [f"{element}的隐性暗示"],
            "composite_labels": [f"虽然{element}但是还有转折"],
            "evolution_factor": point.backtrack_probability
        }
    
    def _get_starting_emotion(self, point: PlotPoint) -> str:
        """Get starting emotion for plot point"""
        emotions = ["平静", "期待", "焦虑", "兴奋", "恐惧", "希望"]
        intensity = point.emotional_intensity
        return f"{random.choice(emotions)}({intensity * 0.3:.1f})"
    
    def _get_ending_emotion(self, point: PlotPoint) -> str:
        """Get ending emotion for plot point"""
        emotions = ["满足", "失落", "成长", "领悟", "改变", "决心"]
        intensity = point.emotional_intensity
        return f"{random.choice(emotions)}({intensity:.1f})"
    
    def _identify_emotional_peaks(self, point: PlotPoint) -> List[str]:
        """Identify emotional peaks in plot point"""
        num_peaks = max(1, int(point.emotional_intensity * 3))
        peaks = []
        for i in range(num_peaks):
            peaks.append(f"情感高峰{i+1}({point.emotional_intensity:.1f})")
        return peaks
    
    def _generate_emotional_transitions(self, point: PlotPoint) -> List[str]:
        """Generate emotional transitions for plot point"""
        transitions = ["逐渐升温", "突然转变", "螺旋上升", "波浪起伏"]
        return random.sample(transitions, min(2, len(transitions)))
    
    def _generate_story_segments(self, template: TemplateConfiguration,
                                 parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate story segments"""
        segments = []
        
        for i, point in enumerate(template.plot_points[:-1]):
            next_point = template.plot_points[i + 1]
            segment = {
                "from_plot_point": point.id,
                "to_plot_point": next_point.id,
                "transition_type": self._determine_transition_type(point, next_point),
                "emotional_progression": self._calculate_emotional_progression(point, next_point),
                "conflict_escalation": self._calculate_conflict_escalation(point, next_point),
                "character_development": self._track_character_development(point, next_point),
                "star_transitions": self._generate_star_transitions(point, next_point)
            }
            segments.append(segment)
        
        return segments
    
    def _determine_transition_type(self, current: PlotPoint, next_point: PlotPoint) -> str:
        """Determine transition type between plot points"""
        if next_point.emotional_intensity > current.emotional_intensity:
            return "情感升级"
        elif next_point.conflict_level > current.conflict_level:
            return "冲突加剧"
        else:
            return "平稳过渡"
    
    def _calculate_emotional_progression(self, current: PlotPoint, next_point: PlotPoint) -> str:
        """Calculate emotional progression between points"""
        diff = next_point.emotional_intensity - current.emotional_intensity
        if diff > 0.3:
            return "急剧上升"
        elif diff > 0:
            return "逐步上升"
        elif diff < -0.3:
            return "急剧下降"
        else:
            return "保持平稳"
    
    def _calculate_conflict_escalation(self, current: PlotPoint, next_point: PlotPoint) -> str:
        """Calculate conflict escalation between points"""
        diff = next_point.conflict_level - current.conflict_level
        if diff > 0.3:
            return "冲突爆发"
        elif diff > 0:
            return "冲突升级"
        else:
            return "冲突稳定"
    
    def _track_character_development(self, current: PlotPoint, next_point: PlotPoint) -> str:
        """Track character development between points"""
        diff = next_point.character_change - current.character_change
        if diff > 0.3:
            return "重大成长"
        elif diff > 0:
            return "逐步成长"
        else:
            return "成长停滞"
    
    def _generate_star_transitions(self, current: PlotPoint, next_point: PlotPoint) -> Dict[str, Any]:
        """Generate Star transitions between points"""
        return {
            "explicit_transitions": ["显性过渡元素1", "显性过渡元素2"],
            "implicit_transitions": ["隐性过渡暗示1", "隐性过渡暗示2"],
            "composite_transitions": ["虽然{current_state}但是{next_state}"],
            "backtrack_probability": (current.backtrack_probability + next_point.backtrack_probability) / 2
        }
    
    def _generate_field_content(self, mapping: StarFieldMapping,
                              context: Dict[str, Any]) -> str:
        """Generate field content based on mapping rules"""
        # Simplified implementation
        rule = random.choice(mapping.generation_rules)
        return f"生成的{mapping.field_name}内容:{rule}"
    
    def _check_dependencies(self, mapping: StarFieldMapping,
                          context: Dict[str, Any]) -> Dict[str, bool]:
        """Check dependencies for field mapping"""
        dependency_status = {}
        for dependency in mapping.dependencies:
            dependency_status[dependency] = dependency in context
        return dependency_status
    
    def _validate_field_assignment(self, mapping: StarFieldMapping,
                                 context: Dict[str, Any]) -> Dict[str, bool]:
        """Validate field assignment"""
        validation_result = {}
        for rule in mapping.validation_rules:
            validation_result[rule] = True  # Simplified validation
        return validation_result
    
    def _calculate_overall_quality(self, outline: Dict[str, Any],
                                   template: TemplateConfiguration) -> float:
        """Calculate overall quality score"""
        # Simplified quality calculation
        base_quality = 0.7
        plot_point_quality = len(outline["plot_points"]) / len(template.plot_points)
        coherence_bonus = 0.1 if outline.get("story_segments") else 0
        
        return min(base_quality + plot_point_quality * 0.2 + coherence_bonus, 1.0)
    
    def _calculate_coherence(self, outline: Dict[str, Any]) -> float:
        """Calculate coherence score"""
        # Simplified coherence calculation
        return 0.8 if len(outline.get("story_segments", [])) > 0 else 0.5
    
    def _calculate_emotional_continuity(self, outline: Dict[str, Any]) -> float:
        """Calculate emotional continuity"""
        # Simplified emotional continuity calculation
        plot_points = outline.get("plot_points", [])
        if len(plot_points) < 2:
            return 0.5
        
        emotional_changes = []
        for i in range(len(plot_points) - 1):
            current_intensity = plot_points[i].get("emotional_intensity", 0)
            next_intensity = plot_points[i + 1].get("emotional_intensity", 0)
            emotional_changes.append(abs(next_intensity - current_intensity))
        
        avg_change = sum(emotional_changes) / len(emotional_changes)
        return max(0.5, 1.0 - avg_change)
    
    def _calculate_plot_consistency(self, outline: Dict[str, Any]) -> float:
        """Calculate plot consistency"""
        # Simplified plot consistency calculation
        return 0.85 if len(outline.get("plot_points", [])) > 3 else 0.6
    
    def _calculate_star_compliance(self, outline: Dict[str, Any],
                                 template: TemplateConfiguration) -> float:
        """Calculate Star compliance"""
        # Simplified Star compliance calculation
        plot_points = outline.get("plot_points", [])
        star_scores = []
        
        for point in plot_points:
            star_features = point.get("star_features", {})
            explicit_count = len(star_features.get("显性符号", []))
            implicit_count = len(star_features.get("隐性符号", []))
            composite_count = len(star_features.get("复合标签", []))
            
            total_star = explicit_count + implicit_count + composite_count
            star_scores.append(min(total_star / 3, 1.0))
        
        return sum(star_scores) / len(star_scores) if star_scores else 0.5
    
    def _predict_reader_engagement(self, outline: Dict[str, Any]) -> float:
        """Predict reader engagement"""
        # Simplified reader engagement prediction
        plot_points = outline.get("plot_points", [])
        if not plot_points:
            return 0.5
        
        avg_emotional_intensity = sum(
            point.get("emotional_intensity", 0) for point in plot_points
        ) / len(plot_points)
        
        # Higher emotional intensity generally leads to better engagement
        return min(0.9, 0.4 + avg_emotional_intensity * 0.5)
    
    def analyze_story_content(self, content: str) -> Dict[str, Any]:
        """Analyze existing story content and extract Star elements"""
        analysis = {
            "explicit_symbols": self._extract_explicit_symbols(content),
            "implicit_symbols": self._extract_implicit_symbols(content),
            "composite_labels": self._extract_composite_labels(content),
            "emotional_progression": self._analyze_emotional_progression(content),
            "conflict_development": self._analyze_conflict_development(content),
            "character_arcs": self._analyze_character_arcs(content),
            "star_score": self._calculate_content_star_score(content),
            "improvement_suggestions": self._generate_improvement_suggestions(content)
        }
        
        return analysis
    
    def _extract_explicit_symbols(self, content: str) -> List[Dict[str, Any]]:
        """Extract explicit symbols from content"""
        explicit_patterns = [
            r"猛地\w+", r"突然\w+", r"迅速\w+", r"缓缓\w+",
            r"阳光明媚", r"乌云密布", r"电闪雷鸣", r"风平浪静"
        ]
        
        symbols = []
        for pattern in explicit_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                symbols.append({
                    "symbol": match,
                    "type": "explicit",
                    "context": self._get_context_around_symbol(content, match),
                    "intensity": self._calculate_symbol_intensity(match)
                })
        
        return symbols
    
    def _extract_implicit_symbols(self, content: str) -> List[Dict[str, Any]]:
        """Extract implicit symbols from content"""
        implicit_patterns = [
            r"眼神\w+", r"表情\w+", r"姿态\w+", r"语气\w+",
            r"心中\w+", r"眼底\w+", r"嘴角\w+", r"眉宇\w+"
        ]
        
        symbols = []
        for pattern in implicit_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                symbols.append({
                    "symbol": match,
                    "type": "implicit",
                    "context": self._get_context_around_symbol(content, match),
                    "emotional_depth": self._calculate_emotional_depth(match)
                })
        
        return symbols
    
    def _extract_composite_labels(self, content: str) -> List[Dict[str, Any]]:
        """Extract composite labels from content"""
        composite_patterns = [
            r"虽然.*但是.*", r"尽管.*仍然.*", r"不是.*而是.*",
            r"一方面.*另一方面.*", r"不是.*就是.*", r"既.*又.*"
        ]
        
        labels = []
        for pattern in composite_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                labels.append({
                    "label": match,
                    "type": "composite",
                    "complexity": self._calculate_composite_complexity(match),
                    "emotional_contrast": self._calculate_emotional_contrast(match)
                })
        
        return labels
    
    def _analyze_emotional_progression(self, content: str) -> Dict[str, Any]:
        """Analyze emotional progression in content"""
        # Simplified emotional analysis
        emotional_words = {
            "喜悦": ["开心", "快乐", "兴奋", "满足", "幸福"],
            "悲伤": ["难过", "伤心", "痛苦", "失落", "绝望"],
            "愤怒": ["生气", "愤怒", "暴怒", "恼火", "愤慨"],
            "恐惧": ["害怕", "恐惧", "担心", "焦虑", "不安"],
            "惊讶": ["吃惊", "意外", "震惊", "诧异", "惊奇"]
        }
        
        emotional_progression = {}
        paragraphs = content.split('\n\n')
        
        for i, paragraph in enumerate(paragraphs):
            paragraph_emotions = {}
            for emotion, words in emotional_words.items():
                count = sum(paragraph.count(word) for word in words)
                if count > 0:
                    paragraph_emotions[emotion] = count
            
            if paragraph_emotions:
                emotional_progression[f"paragraph_{i}"] = paragraph_emotions
        
        return {
            "emotional_timeline": emotional_progression,
            "dominant_emotion": self._find_dominant_emotion(emotional_progression),
            "emotional_intensity": self._calculate_overall_emotional_intensity(emotional_progression),
            "emotional_arc": self._identify_emotional_arc(emotional_progression)
        }
    
    def _analyze_conflict_development(self, content: str) -> Dict[str, Any]:
        """Analyze conflict development in content"""
        conflict_indicators = [
            "冲突", "矛盾", "对立", "分歧", "争执", "争斗",
            "反对", "反抗", "抵抗", "挑战", "困难", "障碍"
        ]
        
        paragraphs = content.split('\n\n')
        conflict_timeline = {}
        
        for i, paragraph in enumerate(paragraphs):
            conflict_score = sum(paragraph.count(indicator) for indicator in conflict_indicators)
            if conflict_score > 0:
                conflict_timeline[f"paragraph_{i}"] = conflict_score
        
        return {
            "conflict_timeline": conflict_timeline,
            "conflict_intensity": self._calculate_conflict_intensity(conflict_timeline),
            "conflict_peaks": self._identify_conflict_peaks(conflict_timeline),
            "conflict_resolution": self._analyze_conflict_resolution(content)
        }
    
    def _analyze_character_arcs(self, content: str) -> List[Dict[str, Any]]:
        """Analyze character arcs in content"""
        # Simplified character analysis
        characters = self._extract_characters(content)
        character_arcs = []
        
        for character in characters:
            arc = {
                "character": character,
                "development_stages": self._identify_development_stages(content, character),
                "key_changes": self._identify_key_changes(content, character),
                "growth_indicators": self._identify_growth_indicators(content, character)
            }
            character_arcs.append(arc)
        
        return character_arcs
    
    def _calculate_content_star_score(self, content: str) -> float:
        """Calculate Star score for content"""
        explicit_symbols = self._extract_explicit_symbols(content)
        implicit_symbols = self._extract_implicit_symbols(content)
        composite_labels = self._extract_composite_labels(content)
        
        # Calculate weighted score based on Star principles
        explicit_score = len(explicit_symbols) * 0.4
        implicit_score = len(implicit_symbols) * 0.35
        composite_score = len(composite_labels) * 0.25
        
        total_score = explicit_score + implicit_score + composite_score
        max_possible = len(content.split()) * 0.1  # Rough estimate
        
        return min(total_score / max_possible if max_possible > 0 else 0, 1.0)
    
    def _generate_improvement_suggestions(self, content: str) -> List[Dict[str, Any]]:
        """Generate improvement suggestions based on Star analysis"""
        suggestions = []
        
        # Check for explicit symbols
        explicit_symbols = self._extract_explicit_symbols(content)
        if len(explicit_symbols) < 5:
            suggestions.append({
                "type": "explicit_symbols",
                "priority": "high",
                "suggestion": "增加更多显性符号,如动作描写、环境描写等",
                "examples": ["猛地站起来", "突然转身", "阳光明媚的早晨"]
            })
        
        # Check for implicit symbols
        implicit_symbols = self._extract_implicit_symbols(content)
        if len(implicit_symbols) < 3:
            suggestions.append({
                "type": "implicit_symbols",
                "priority": "medium",
                "suggestion": "增加更多隐性符号,如眼神、表情、姿态等内心描写",
                "examples": ["眼神闪烁不定", "嘴角微微上扬", "心中涌起一阵波澜"]
            })
        
        # Check for composite labels
        composite_labels = self._extract_composite_labels(content)
        if len(composite_labels) < 2:
            suggestions.append({
                "type": "composite_labels",
                "priority": "medium",
                "suggestion": "增加更多复合标签,增强文本的复杂性和层次感",
                "examples": ["虽然表面上平静,但是内心却波涛汹涌", "不是选择逃避,而是勇敢面对"]
            })
        
        return suggestions
    
    # Additional helper methods for content analysis
    def _get_context_around_symbol(self, content: str, symbol: str, context_size: int = 20) -> str:
        """Get context around a symbol"""
        index = content.find(symbol)
        if index == -1:
            return ""
        
        start = max(0, index - context_size)
        end = min(len(content), index + len(symbol) + context_size)
        return content[start:end]
    
    def _calculate_symbol_intensity(self, symbol: str) -> float:
        """Calculate intensity of a symbol"""
        intensity_words = ["猛地", "突然", "强烈", "激烈", "极端"]
        intensity = sum(1 for word in intensity_words if word in symbol)
        return min(intensity / len(intensity_words), 1.0)
    
    def _calculate_emotional_depth(self, symbol: str) -> float:
        """Calculate emotional depth of an implicit symbol"""
        depth_indicators = ["内心", "心中", "眼底", "深处", "隐藏", "秘密"]
        depth = sum(1 for indicator in depth_indicators if indicator in symbol)
        return min(depth / len(depth_indicators), 1.0)
    
    def _calculate_composite_complexity(self, label: str) -> float:
        """Calculate complexity of a composite label"""
        complexity_indicators = ["虽然", "但是", "尽管", "仍然", "不是", "而是", "一方面", "另一方面"]
        complexity = sum(1 for indicator in complexity_indicators if indicator in label)
        return min(complexity / 4, 1.0)  # Normalize to 0-1
    
    def _calculate_emotional_contrast(self, label: str) -> float:
        """Calculate emotional contrast in composite label"""
        # Simple emotional contrast detection
        positive_words = ["好", "开心", "快乐", "幸福", "美好", "温暖"]
        negative_words = ["坏", "难过", "痛苦", "悲伤", "糟糕", "寒冷"]
        
        positive_count = sum(1 for word in positive_words if word in label)
        negative_count = sum(1 for word in negative_words if word in label)
        
        return min((positive_count + negative_count) / 4, 1.0)
    
    def _find_dominant_emotion(self, emotional_progression: Dict[str, Any]) -> str:
        """Find dominant emotion from progression"""
        emotion_counts = {}
        for paragraph_emotions in emotional_progression.values():
            for emotion, count in paragraph_emotions.items():
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + count
        
        return max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else "中性"
    
    def _calculate_overall_emotional_intensity(self, emotional_progression: Dict[str, Any]) -> float:
        """Calculate overall emotional intensity"""
        total_intensity = 0
        count = 0
        
        for paragraph_emotions in emotional_progression.values():
            total_intensity += sum(paragraph_emotions.values())
            count += len(paragraph_emotions)
        
        return min(total_intensity / count if count > 0 else 0, 1.0)
    
    def _identify_emotional_arc(self, emotional_progression: Dict[str, Any]) -> str:
        """Identify emotional arc pattern"""
        # Simplified arc identification
        intensities = []
        for paragraph_emotions in emotional_progression.values():
            intensity = sum(paragraph_emotions.values())
            intensities.append(intensity)
        
        if len(intensities) < 2:
            return "平稳"
        
        # Simple trend analysis
        increasing = sum(1 for i in range(1, len(intensities)) if intensities[i] > intensities[i-1])
        decreasing = sum(1 for i in range(1, len(intensities)) if intensities[i] < intensities[i-1])
        
        if increasing > decreasing:
            return "上升"
        elif decreasing > increasing:
            return "下降"
        else:
            return "波动"
    
    def _calculate_conflict_intensity(self, conflict_timeline: Dict[str, Any]) -> float:
        """Calculate overall conflict intensity"""
        if not conflict_timeline:
            return 0
        
        total_intensity = sum(conflict_timeline.values())
        return min(total_intensity / len(conflict_timeline) / 10, 1.0)  # Normalize
    
    def _identify_conflict_peaks(self, conflict_timeline: Dict[str, Any]) -> List[str]:
        """Identify conflict peaks"""
        if not conflict_timeline:
            return []
        
        max_intensity = max(conflict_timeline.values())
        threshold = max_intensity * 0.7
        
        peaks = [paragraph for paragraph, intensity in conflict_timeline.items() 
                if intensity >= threshold]
        
        return peaks
    
    def _analyze_conflict_resolution(self, content: str) -> Dict[str, Any]:
        """Analyze conflict resolution"""
        resolution_indicators = ["解决", "化解", "和解", "消除", "克服", "战胜"]
        resolution_count = sum(content.count(indicator) for indicator in resolution_indicators)
        
        return {
            "resolution_strength": min(resolution_count / 10, 1.0),
            "resolution_completeness": "完全" if resolution_count > 5 else "部分" if resolution_count > 0 else "未解决"
        }
    
    def _extract_characters(self, content: str) -> List[str]:
        """Extract characters from content"""
        # Simplified character extraction - in practice would use NER
        common_names = ["小明", "小红", "张三", "李四", "王五", "主角", "配角", "侦探", "嫌疑人"]
        found_characters = []
        
        for name in common_names:
            if name in content:
                found_characters.append(name)
        
        return found_characters if found_characters else ["主角"]
    
    def _identify_development_stages(self, content: str, character: str) -> List[str]:
        """Identify character development stages"""
        # Simplified development stage identification
        return ["初始状态", "遇到挑战", "经历变化", "最终状态"]
    
    def _identify_key_changes(self, content: str, character: str) -> List[str]:
        """Identify key changes for character"""
        # Simplified key change identification
        return ["性格转变", "观念更新", "能力提升", "情感成熟"]
    
    def _identify_growth_indicators(self, content: str, character: str) -> List[str]:
        """Identify growth indicators for character"""
        # Simplified growth indicator identification
        return ["学会新技能", "获得新认知", "建立新关系", "克服旧缺点"]

# Example usage and testing
if __name__ == "__main__":
    # Initialize the engine
    engine = StarPlotFormulaEngine()
    
    # Generate a story outline using three-act structure
    parameters = {
        "genre": "romance",
        "length": "medium",
        "complexity": "complex",
        "emotional_intensity": "high",
        "character_focus": "dual_lead"
    }
    
    result = engine.generate_story_outline("three_act_star", parameters)
    
    print("=== Star剧情公式生成结果 ===")
    print(f"模板ID: {result['outline']['template_id']}")
    print(f"情节点数量: {len(result['outline']['plot_points'])}")
    print(f"整体质量分数: {result['quality_metrics']['overall_quality']:.2f}")
    print(f"Star特征分数: {result['quality_metrics']['star_compliance']:.2f}")
    
    # Analyze existing content
    sample_content = """
    小明猛地站起身来,眼神中闪烁着坚定的光芒.虽然内心充满了恐惧,但是他还是决定勇敢面对.
    阳光透过窗户洒进来,照在他略显苍白但是坚毅的脸上.不是选择逃避,而是选择坚持,
    这让他感到一种前所未有的力量在心中涌动.
    """
    
    analysis = engine.analyze_story_content(sample_content)
    
    print("\n=== 内容分析结果 ===")
    print(f"显性符号数量: {len(analysis['explicit_symbols'])}")
    print(f"隐性符号数量: {len(analysis['implicit_symbols'])}")
    print(f"复合标签数量: {len(analysis['composite_labels'])}")
    print(f"Star总分: {analysis['star_score']:.2f}")
    
    if analysis['improvement_suggestions']:
        print("\n改进建议:")
        for suggestion in analysis['improvement_suggestions']:
            print(f"- {suggestion['suggestion']} (优先级: {suggestion['priority']})")
        