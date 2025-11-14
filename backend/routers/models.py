"""
@license
SPDX-License-Identifier: Apache-2.0
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List, Optional
import aiohttp
import asyncio
import logging
from datetime import datetime

from api_framework import ApiException, ErrorCode, get_request_id, log_request, log_response
from contracts import (
    ApiResponse, ModelConfigContract, ModelTestRequest, ModelTestResponse,
    success_response, error_response
)
from services.db_service import get_db_service
from services.ai_service import AIService

router = APIRouter(prefix="/models", tags=["models"])
logger = logging.getLogger(__name__)

@router.get("/configs", response_model=ApiResponse[List[ModelConfigContract]])
async def get_model_configs(request: Request):
    """Get all model configurations from database"""
    log_request(request)
    
    try:
        db_service = await get_db_service()
        
        # Query model configurations from database
        configs = await db_service.get_model_configs()
        
        # Remove sensitive information (API keys)
        safe_configs = []
        for config in configs:
            safe_config = config.copy()
            safe_config.pop('api_key', None)
            safe_configs.append(safe_config)
        
        response = success_response(safe_configs, "Model configurations retrieved successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"Failed to get model configurations: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to retrieve model configurations",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.post("/configs", response_model=ApiResponse[ModelConfigContract])
async def create_model_config(
    config: ModelConfigContract, 
    request: Request
):
    """Create new model configuration in database"""
    log_request(request, config.dict())
    
    try:
        # Validate configuration
        if not config.name or not config.model_id:
            raise ApiException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code=ErrorCode.VALIDATION_ERROR,
                message="Model name and ID cannot be empty",
                request_id=get_request_id(request)
            )
        
        db_service = await get_db_service()
        
        # Check if configuration already exists
        existing = await db_service.get_model_config_by_id(config.id)
        if existing:
            raise ApiException(
                status_code=status.HTTP_409_CONFLICT,
                code=ErrorCode.CONFLICT,
                message=f"Model configuration {config.id} already exists",
                request_id=get_request_id(request)
            )
        
        # Save new configuration to database
        new_config = await db_service.create_model_config(config.dict())
        
        # Remove sensitive information
        safe_config = new_config.copy()
        safe_config.pop('api_key', None)
        
        response = success_response(safe_config, "Model configuration created successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"Failed to create model configuration: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to create model configuration",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.post("/test", response_model=ApiResponse[ModelTestResponse])
async def test_model(
    test_request: ModelTestRequest,
    request: Request
):
    """Test model connection with actual API call"""
    log_request(request, test_request.dict())
    
    try:
        db_service = await get_db_service()
        
        # Find model configuration from database
        model_config = await db_service.get_model_config_by_id(test_request.model_id)
        
        if not model_config:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"Model configuration {test_request.model_id} not found",
                request_id=get_request_id(request)
            )
        
        # Test prompt
        test_prompt = test_request.test_prompt or "Hello! Please respond to confirm connection."
        
        # Test using AIService
        start_time = datetime.now()
        
        try:
            async with AIService() as ai_service:
                # Call actual model API using run_agent
                response_text = await ai_service.run_agent(
                    prompt=test_prompt,
                    model_id=test_request.model_id,
                    parameters={"max_tokens": 100, "temperature": 0.7}
                )
            
            end_time = datetime.now()
            latency = (end_time - start_time).total_seconds()
            
            result = ModelTestResponse(
                success=True,
                response=response_text[:200] if response_text else "No response",
                error=None,
                latency=latency
            )
            
        except Exception as e:
            end_time = datetime.now()
            latency = (end_time - start_time).total_seconds()
            
            result = ModelTestResponse(
                success=False,
                response=None,
                error=f"API test failed: {str(e)}",
                latency=latency
            )
        
        response = success_response(result.dict(), "Model test completed", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"Model test failed: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.AI_MODEL_ERROR,
            message="Model test failed",
            details=str(e),
            request_id=get_request_id(request)
        )

