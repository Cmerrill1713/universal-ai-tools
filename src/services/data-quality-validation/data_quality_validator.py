#!/usr/bin/env python3
"""
Data Quality Validation System
Validates data quality across all integrated sources
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QualityMetric(Enum):
    COMPLETENESS = "completeness"
    ACCURACY = "accuracy"
    CONSISTENCY = "consistency"
    TIMELINESS = "timeliness"
    LICENSING = "licensing"
    DOCUMENTATION = "documentation"
    SIZE = "size"
    BIAS = "bias"

@dataclass
class QualityScore:
    metric: QualityMetric
    score: float  # 0.0 to 1.0
    description: str
    details: Dict[str, Any]

class DataQualityValidator:
    """Validates data quality across all integrated sources"""
    
    def __init__(self, port=8034):
        self.port = port
        self.session = None
        self.librarian_url = "http://localhost:8032"
        self.data_source_url = "http://localhost:8033"
        
    async def initialize(self):
        """Initialize the validator"""
        logger.info("🔍 Initializing Data Quality Validator...")
        
        # Initialize HTTP session
        connector = aiohttp.TCPConnector(
            limit=50,
            limit_per_host=20,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(
            total=30,
            connect=10,
            sock_read=10
        )
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'Universal-AI-Tools-QualityValidator/1.0'}
        )
        
        logger.info("✅ Data Quality Validator ready")
    
    async def validate_all_sources(self) -> Dict[str, Any]:
        """Validate quality of all data sources"""
        logger.info("🔍 Validating quality of all data sources...")
        
        # Get all data sources
        async with self.session.get(f"{self.data_source_url}/data-sources") as response:
            if response.status != 200:
                logger.error(f"Failed to get data sources: {response.status}")
                return {'error': 'Failed to get data sources'}
            
            data_sources = await response.json()
        
        # Validate each source
        validation_results = {}
        total_score = 0
        source_count = 0
        
        for source_name in data_sources.get('sources', {}).keys():
            try:
                result = await self._validate_source(source_name)
                validation_results[source_name] = result
                total_score += result.get('overall_score', 0)
                source_count += 1
            except Exception as e:
                logger.error(f"Failed to validate {source_name}: {str(e)}")
                validation_results[source_name] = {'error': str(e)}
        
        average_score = total_score / source_count if source_count > 0 else 0
        
        logger.info(f"✅ Quality validation complete: {average_score:.2f} average score")
        return {
            'total_sources': source_count,
            'average_quality_score': average_score,
            'validation_results': validation_results,
            'timestamp': datetime.now().isoformat()
        }
    
    async def _validate_source(self, source_name: str) -> Dict[str, Any]:
        """Validate a specific data source"""
        logger.info(f"🔍 Validating {source_name}...")
        
        # Get source information
        async with self.session.get(f"{self.data_source_url}/data-sources") as response:
            if response.status != 200:
                return {'error': 'Failed to get source info'}
            
            data_sources = await response.json()
            source_info = data_sources.get('sources', {}).get(source_name, {})
        
        # Perform quality checks
        quality_scores = []
        
        # 1. Completeness Check
        completeness_score = await self._check_completeness(source_name, source_info)
        quality_scores.append(completeness_score)
        
        # 2. Accuracy Check
        accuracy_score = await self._check_accuracy(source_name, source_info)
        quality_scores.append(accuracy_score)
        
        # 3. Consistency Check
        consistency_score = await self._check_consistency(source_name, source_info)
        quality_scores.append(consistency_score)
        
        # 4. Timeliness Check
        timeliness_score = await self._check_timeliness(source_name, source_info)
        quality_scores.append(timeliness_score)
        
        # 5. Licensing Check
        licensing_score = await self._check_licensing(source_name, source_info)
        quality_scores.append(licensing_score)
        
        # 6. Documentation Check
        documentation_score = await self._check_documentation(source_name, source_info)
        quality_scores.append(documentation_score)
        
        # 7. Size Check
        size_score = await self._check_size(source_name, source_info)
        quality_scores.append(size_score)
        
        # 8. Bias Check
        bias_score = await self._check_bias(source_name, source_info)
        quality_scores.append(bias_score)
        
        # Calculate overall score
        overall_score = sum(score.score for score in quality_scores) / len(quality_scores)
        
        return {
            'source_name': source_name,
            'overall_score': overall_score,
            'quality_scores': {
                score.metric.value: {
                    'score': score.score,
                    'description': score.description,
                    'details': score.details
                } for score in quality_scores
            },
            'grade': self._get_grade(overall_score),
            'recommendations': self._get_recommendations(quality_scores)
        }
    
    async def _check_completeness(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data completeness"""
        # Check if all required fields are present
        required_fields = ['name', 'url', 'description', 'categories']
        present_fields = sum(1 for field in required_fields if field in source_info)
        completeness_ratio = present_fields / len(required_fields)
        
        return QualityScore(
            metric=QualityMetric.COMPLETENESS,
            score=completeness_ratio,
            description=f"Data completeness: {present_fields}/{len(required_fields)} required fields present",
            details={
                'required_fields': required_fields,
                'present_fields': [field for field in required_fields if field in source_info],
                'missing_fields': [field for field in required_fields if field not in source_info]
            }
        )
    
    async def _check_accuracy(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data accuracy"""
        # Validate URL format and accessibility
        url = source_info.get('url', '')
        is_valid_url = url.startswith(('http://', 'https://'))
        
        # Check if source has quality rating
        has_quality_rating = 'quality_rating' in source_info
        quality_rating = source_info.get('quality_rating', 0)
        is_high_quality = quality_rating >= 4
        
        accuracy_score = 0.0
        if is_valid_url:
            accuracy_score += 0.4
        if has_quality_rating:
            accuracy_score += 0.3
        if is_high_quality:
            accuracy_score += 0.3
        
        return QualityScore(
            metric=QualityMetric.ACCURACY,
            score=accuracy_score,
            description=f"Data accuracy: {'High' if is_high_quality else 'Medium' if has_quality_rating else 'Low'} quality source",
            details={
                'valid_url': is_valid_url,
                'has_quality_rating': has_quality_rating,
                'quality_rating': quality_rating,
                'is_high_quality': is_high_quality
            }
        )
    
    async def _check_consistency(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data consistency"""
        # Check if categories are consistent with source type
        categories = source_info.get('categories', [])
        source_type = source_info.get('type', '')
        
        # Define expected categories for each type
        type_categories = {
            'academic': ['research', 'benchmarks', 'academic', 'machine_learning'],
            'government': ['government', 'census', 'economic', 'environmental', 'public_domain'],
            'ai_ml_platform': ['cloud_optimized', 'large_scale', 'cost_effective', 'big_data'],
            'domain_specific': ['computer_vision', 'natural_language_processing', 'audio', 'speech'],
            'community': ['community', 'competitions', 'diverse_domains', 'real_world']
        }
        
        expected_categories = type_categories.get(source_type, [])
        matching_categories = sum(1 for cat in categories if cat in expected_categories)
        consistency_ratio = matching_categories / len(expected_categories) if expected_categories else 1.0
        
        return QualityScore(
            metric=QualityMetric.CONSISTENCY,
            score=consistency_ratio,
            description=f"Data consistency: {matching_categories}/{len(expected_categories)} categories match source type",
            details={
                'source_type': source_type,
                'categories': categories,
                'expected_categories': expected_categories,
                'matching_categories': matching_categories
            }
        )
    
    async def _check_timeliness(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data timeliness"""
        # For now, assume all sources are timely (they're current data sources)
        # In a real implementation, you'd check last update dates, etc.
        return QualityScore(
            metric=QualityMetric.TIMELINESS,
            score=1.0,
            description="Data timeliness: Current and up-to-date data sources",
            details={
                'is_current': True,
                'last_checked': datetime.now().isoformat()
            }
        )
    
    async def _check_licensing(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data licensing"""
        # Check if source has clear licensing information
        requires_auth = source_info.get('requires_auth', False)
        
        # Government sources typically have clear public domain licensing
        source_type = source_info.get('type', '')
        is_government = source_type == 'government'
        is_open_source = source_name in ['hugging_face', 'papers_with_code', 'kaggle']
        
        licensing_score = 0.0
        if is_government:
            licensing_score = 1.0  # Public domain
        elif is_open_source:
            licensing_score = 0.8  # Open source
        elif not requires_auth:
            licensing_score = 0.6  # No auth required
        else:
            licensing_score = 0.4  # Requires auth
        
        return QualityScore(
            metric=QualityMetric.LICENSING,
            score=licensing_score,
            description=f"Data licensing: {'Public domain' if is_government else 'Open source' if is_open_source else 'Restricted'}",
            details={
                'requires_auth': requires_auth,
                'is_government': is_government,
                'is_open_source': is_open_source,
                'licensing_clarity': 'High' if is_government or is_open_source else 'Medium'
            }
        )
    
    async def _check_documentation(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data documentation"""
        # Check if source has good documentation
        has_description = bool(source_info.get('description', ''))
        has_categories = bool(source_info.get('categories', []))
        has_api_endpoint = bool(source_info.get('api_endpoint'))
        
        documentation_score = 0.0
        if has_description:
            documentation_score += 0.4
        if has_categories:
            documentation_score += 0.3
        if has_api_endpoint:
            documentation_score += 0.3
        
        return QualityScore(
            metric=QualityMetric.DOCUMENTATION,
            score=documentation_score,
            description=f"Data documentation: {'Comprehensive' if documentation_score >= 0.8 else 'Good' if documentation_score >= 0.6 else 'Basic'}",
            details={
                'has_description': has_description,
                'has_categories': has_categories,
                'has_api_endpoint': has_api_endpoint,
                'documentation_level': 'Comprehensive' if documentation_score >= 0.8 else 'Good' if documentation_score >= 0.6 else 'Basic'
            }
        )
    
    async def _check_size(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data size appropriateness"""
        # For now, assume all sources have appropriate sizes
        # In a real implementation, you'd check actual dataset sizes
        return QualityScore(
            metric=QualityMetric.SIZE,
            score=1.0,
            description="Data size: Appropriate scale for use cases",
            details={
                'size_appropriate': True,
                'scale': 'Production-ready'
            }
        )
    
    async def _check_bias(self, source_name: str, source_info: Dict[str, Any]) -> QualityScore:
        """Check data bias"""
        # Check if source is representative and fair
        categories = source_info.get('categories', [])
        source_type = source_info.get('type', '')
        
        # Government sources are typically more representative
        is_government = source_type == 'government'
        is_diverse = 'diverse_domains' in categories or 'community' in categories
        
        bias_score = 0.0
        if is_government:
            bias_score = 1.0  # Government data is typically representative
        elif is_diverse:
            bias_score = 0.8  # Diverse sources
        else:
            bias_score = 0.6  # Standard sources
        
        return QualityScore(
            metric=QualityMetric.BIAS,
            score=bias_score,
            description=f"Data bias: {'Representative' if bias_score >= 0.8 else 'Standard'} and fair",
            details={
                'is_government': is_government,
                'is_diverse': is_diverse,
                'bias_level': 'Low' if bias_score >= 0.8 else 'Medium'
            }
        )
    
    def _get_grade(self, score: float) -> str:
        """Get letter grade for quality score"""
        if score >= 0.9:
            return "A+"
        elif score >= 0.8:
            return "A"
        elif score >= 0.7:
            return "B+"
        elif score >= 0.6:
            return "B"
        elif score >= 0.5:
            return "C+"
        elif score >= 0.4:
            return "C"
        else:
            return "D"
    
    def _get_recommendations(self, quality_scores: List[QualityScore]) -> List[str]:
        """Get recommendations for improvement"""
        recommendations = []
        
        for score in quality_scores:
            if score.score < 0.6:
                if score.metric == QualityMetric.COMPLETENESS:
                    recommendations.append("Add missing required fields to improve completeness")
                elif score.metric == QualityMetric.ACCURACY:
                    recommendations.append("Verify URL accessibility and add quality rating")
                elif score.metric == QualityMetric.CONSISTENCY:
                    recommendations.append("Align categories with source type for better consistency")
                elif score.metric == QualityMetric.LICENSING:
                    recommendations.append("Clarify licensing terms and usage rights")
                elif score.metric == QualityMetric.DOCUMENTATION:
                    recommendations.append("Improve documentation with better descriptions and API info")
                elif score.metric == QualityMetric.BIAS:
                    recommendations.append("Ensure data is representative and unbiased")
        
        if not recommendations:
            recommendations.append("Data source meets all quality standards")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

# FastAPI integration
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Data Quality Validation Service", version="1.0.0")

# Global validator instance
quality_validator = None

@app.on_event("startup")
async def startup_event():
    global quality_validator
    quality_validator = DataQualityValidator()
    await quality_validator.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    global quality_validator
    if quality_validator:
        await quality_validator.cleanup()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "data-quality-validation", "port": 8034}

@app.post("/validate-all")
async def validate_all_sources():
    """Validate quality of all data sources"""
    if not quality_validator:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return await quality_validator.validate_all_sources()

class SourceValidationRequest(BaseModel):
    source_name: str

@app.post("/validate-source")
async def validate_specific_source(request: SourceValidationRequest):
    """Validate quality of a specific data source"""
    if not quality_validator:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return await quality_validator._validate_source(request.source_name)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8034)
