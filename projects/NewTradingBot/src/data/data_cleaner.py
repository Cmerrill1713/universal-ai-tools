"""
Data cleaning and validation module for trading bot.
Handles data quality checks, outlier detection, and data normalization.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Tuple

import numpy as np
import pandas as pd
from scipy import stats

from .market_data import MarketDataPoint

logger = logging.getLogger(__name__)


class DataQualityIssue(Enum):
    """Types of data quality issues."""
    MISSING_VALUES = "missing_values"
    INVALID_PRICES = "invalid_prices"
    PRICE_OUTLIERS = "price_outliers"
    VOLUME_OUTLIERS = "volume_outliers"
    TIME_GAPS = "time_gaps"
    DUPLICATE_DATA = "duplicate_data"
    INCONSISTENT_OHLC = "inconsistent_ohlc"
    EXTREME_VOLATILITY = "extreme_volatility"
    LIQUIDITY_ISSUES = "liquidity_issues"


class CleaningAction(Enum):
    """Actions that can be taken for data cleaning."""
    REMOVE = "remove"
    INTERPOLATE = "interpolate"
    CAP = "cap"
    SMOOTH = "smooth"
    FLAG = "flag"
    CORRECT = "correct"


@dataclass
class QualityIssue:
    """
    Data quality issue record.

    Attributes:
        issue_type: Type of quality issue
        severity: Severity level (0-1)
        description: Human-readable description
        affected_records: Number of affected records
        suggested_action: Recommended action
        metadata: Additional issue data
        timestamp: When issue was detected
    """
    issue_type: DataQualityIssue
    severity: float
    description: str
    affected_records: int
    suggested_action: CleaningAction
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CleaningRule:
    """
    Data cleaning rule configuration.

    Attributes:
        rule_name: Name of the rule
        issue_type: Type of issue this rule addresses
        action: Action to take when issue is found
        parameters: Rule-specific parameters
        is_active: Whether rule is active
        priority: Rule priority (higher = higher priority)
    """
    rule_name: str
    issue_type: DataQualityIssue
    action: CleaningAction
    parameters: Dict[str, Any]
    is_active: bool = True
    priority: int = 1


@dataclass
class CleaningResult:
    """
    Result of data cleaning operation.

    Attributes:
        original_count: Number of original records
        cleaned_count: Number of records after cleaning
        issues_found: List of quality issues found
        actions_taken: List of actions taken
        cleaning_time: Time taken for cleaning
        quality_score: Overall quality score (0-1)
        metadata: Additional result data
    """
    original_count: int
    cleaned_count: int
    issues_found: List[QualityIssue]
    actions_taken: List[str]
    cleaning_time: timedelta
    quality_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class DataCleaner:
    """
    Comprehensive data cleaning and validation system for market data.

    Provides methods to detect and correct various data quality issues
    including outliers, missing data, inconsistencies, and anomalies.
    """

    def __init__(self):
        """Initialize data cleaner with default rules."""
        self.cleaning_rules: List[CleaningRule] = []
        self.custom_validators: List[Callable[[
            pd.DataFrame], List[QualityIssue]]] = []

        # Default thresholds
        # Standard deviations for outlier detection
        self.price_outlier_std_threshold = 3.0
        self.volume_outlier_std_threshold = 3.0
        self.max_price_change_pct = 50.0  # Maximum allowed price change percentage
        self.min_volume_threshold = Decimal('0.001')
        self.max_time_gap_minutes = 60  # Maximum allowed time gap
        # Maximum daily volatility (as z-score)
        self.volatility_threshold = 5.0

        # Initialize default rules
        self._init_default_rules()

    def _init_default_rules(self) -> None:
        """Initialize default cleaning rules."""
        self.cleaning_rules = [
            # Remove records with invalid prices
            CleaningRule(
                rule_name="remove_invalid_prices",
                issue_type=DataQualityIssue.INVALID_PRICES,
                action=CleaningAction.REMOVE,
                parameters={'min_price': 0.0001, 'max_price': 1000000},
                priority=10
            ),

            # Remove OHLC inconsistencies
            CleaningRule(
                rule_name="remove_inconsistent_ohlc",
                issue_type=DataQualityIssue.INCONSISTENT_OHLC,
                action=CleaningAction.REMOVE,
                parameters={},
                priority=9
            ),

            # Cap price outliers
            CleaningRule(
                rule_name="cap_price_outliers",
                issue_type=DataQualityIssue.PRICE_OUTLIERS,
                action=CleaningAction.CAP,
                parameters={'std_threshold': 3.0, 'method': 'iqr'},
                priority=5
            ),

            # Cap volume outliers
            CleaningRule(
                rule_name="cap_volume_outliers",
                issue_type=DataQualityIssue.VOLUME_OUTLIERS,
                action=CleaningAction.CAP,
                parameters={'std_threshold': 3.0, 'method': 'iqr'},
                priority=4
            ),

            # Interpolate missing values
            CleaningRule(
                rule_name="interpolate_missing",
                issue_type=DataQualityIssue.MISSING_VALUES,
                action=CleaningAction.INTERPOLATE,
                parameters={'method': 'linear', 'limit': 5},
                priority=6
            ),

            # Remove duplicates
            CleaningRule(
                rule_name="remove_duplicates",
                issue_type=DataQualityIssue.DUPLICATE_DATA,
                action=CleaningAction.REMOVE,
                parameters={'keep': 'first'},
                priority=8
            ),

            # Flag extreme volatility
            CleaningRule(
                rule_name="flag_extreme_volatility",
                issue_type=DataQualityIssue.EXTREME_VOLATILITY,
                action=CleaningAction.FLAG,
                parameters={'threshold': 5.0},
                priority=2
            )
        ]

    def add_cleaning_rule(self, rule: CleaningRule) -> None:
        """Add a custom cleaning rule."""
        self.cleaning_rules.append(rule)
        # Sort by priority (higher first)
        self.cleaning_rules.sort(key=lambda r: r.priority, reverse=True)

    def add_custom_validator(self,
                             validator: Callable[[pd.DataFrame],
                                                 List[QualityIssue]]) -> None:
        """Add a custom validation function."""
        self.custom_validators.append(validator)

    def clean_ohlcv_data(self,
                         df: pd.DataFrame,
                         symbol: str = None) -> Tuple[pd.DataFrame,
                                                      CleaningResult]:
        """
        Clean OHLCV data DataFrame.

        Args:
            df: DataFrame with OHLCV data
            symbol: Symbol name for logging

        Returns:
            Tuple of (cleaned_dataframe, cleaning_result)
        """
        start_time = datetime.utcnow()
        original_count = len(df)
        issues_found = []
        actions_taken = []

        if df.empty:
            return df, CleaningResult(
                original_count=0,
                cleaned_count=0,
                issues_found=[],
                actions_taken=[],
                cleaning_time=timedelta(0),
                quality_score=1.0
            )

        # Make a copy to avoid modifying original
        cleaned_df = df.copy()

        # Validate data structure
        required_columns = ['open', 'high', 'low', 'close', 'volume']
        missing_columns = [
            col for col in required_columns if col not in cleaned_df.columns]

        if missing_columns:
            issues_found.append(QualityIssue(
                issue_type=DataQualityIssue.MISSING_VALUES,
                severity=1.0,
                description=f"Missing required columns: {missing_columns}",
                affected_records=len(cleaned_df),
                suggested_action=CleaningAction.FLAG
            ))

            # Cannot proceed with cleaning without required columns
            return df, CleaningResult(
                original_count=original_count,
                cleaned_count=0,
                issues_found=issues_found,
                actions_taken=["Failed: Missing required columns"],
                cleaning_time=datetime.utcnow() - start_time,
                quality_score=0.0
            )

        # Run quality checks and collect issues
        issues_found.extend(self._check_data_quality(cleaned_df))

        # Apply cleaning rules in priority order
        for rule in self.cleaning_rules:
            if not rule.is_active:
                continue

            # Find relevant issues for this rule
            relevant_issues = [
                issue for issue in issues_found if issue.issue_type == rule.issue_type]

            if relevant_issues:
                try:
                    cleaned_df, rule_actions = self._apply_cleaning_rule(
                        cleaned_df, rule, relevant_issues)
                    actions_taken.extend(rule_actions)
                except Exception as e:
                    logger.error(f"Error applying rule {rule.rule_name}: {e}")
                    actions_taken.append(f"Error in {rule.rule_name}: {e}")

        # Run custom validators
        for validator in self.custom_validators:
            try:
                custom_issues = validator(cleaned_df)
                issues_found.extend(custom_issues)
            except Exception as e:
                logger.error(f"Error in custom validator: {e}")

        # Calculate quality score
        quality_score = self._calculate_quality_score(cleaned_df, issues_found)

        # Final validation
        cleaned_df = self._final_validation(cleaned_df)

        cleaning_time = datetime.utcnow() - start_time

        result = CleaningResult(
            original_count=original_count,
            cleaned_count=len(cleaned_df),
            issues_found=issues_found,
            actions_taken=actions_taken,
            cleaning_time=cleaning_time,
            quality_score=quality_score,
            metadata={
                'symbol': symbol,
                'data_reduction_pct': (
                    1 -
                    len(cleaned_df) /
                    original_count) *
                100 if original_count > 0 else 0})

        return cleaned_df, result

    def clean_data_points(
            self, data_points: List[MarketDataPoint]) -> Tuple[List[MarketDataPoint], CleaningResult]:
        """
        Clean a list of MarketDataPoint objects.

        Args:
            data_points: List of data points to clean

        Returns:
            Tuple of (cleaned_data_points, cleaning_result)
        """
        if not data_points:
            return data_points, CleaningResult(
                original_count=0,
                cleaned_count=0,
                issues_found=[],
                actions_taken=[],
                cleaning_time=timedelta(0),
                quality_score=1.0
            )

        # Convert to DataFrame for processing
        df_data = []
        for point in data_points:
            df_data.append({
                'timestamp': point.timestamp,
                'open': float(point.open_price) if point.open_price else None,
                'high': float(point.high_price) if point.high_price else None,
                'low': float(point.low_price) if point.low_price else None,
                'close': float(point.close_price) if point.close_price else None,
                'volume': float(point.volume) if point.volume else None,
                'symbol': point.symbol,
                'source': point.source.value
            })

        df = pd.DataFrame(df_data)
        if not df.empty:
            df.set_index('timestamp', inplace=True)

        # Clean the DataFrame
        cleaned_df, result = self.clean_ohlcv_data(df)

        # Convert back to MarketDataPoint objects
        cleaned_points = []
        for idx, row in cleaned_df.iterrows():
            # Find original point to preserve metadata
            original_point = next(
                (p for p in data_points if p.timestamp == idx),
                data_points[0])

            cleaned_point = MarketDataPoint(
                symbol=row.get('symbol', original_point.symbol),
                timestamp=idx,
                source=original_point.source,
                data_type=original_point.data_type,
                data=original_point.data,
                open_price=Decimal(str(row['open'])) if pd.notna(row['open']) else None,
                high_price=Decimal(str(row['high'])) if pd.notna(row['high']) else None,
                low_price=Decimal(str(row['low'])) if pd.notna(row['low']) else None,
                close_price=Decimal(str(row['close'])) if pd.notna(row['close']) else None,
                volume=Decimal(str(row['volume'])) if pd.notna(row['volume']) else None,
                metadata=original_point.metadata
            )
            cleaned_points.append(cleaned_point)

        return cleaned_points, result

    def _check_data_quality(self, df: pd.DataFrame) -> List[QualityIssue]:
        """Comprehensive data quality check."""
        issues = []

        if df.empty:
            return issues

        # Check for missing values
        missing_counts = df.isnull().sum()
        for column, count in missing_counts.items():
            if count > 0:
                severity = min(1.0, count / len(df))
                issues.append(
                    QualityIssue(
                        issue_type=DataQualityIssue.MISSING_VALUES,
                        severity=severity,
                        description=f"Missing values in {column}: {count} ({
                            severity * 100:.1f}%)",
                        affected_records=count,
                        suggested_action=CleaningAction.INTERPOLATE))

        # Check for invalid prices
        price_columns = ['open', 'high', 'low', 'close']
        for col in price_columns:
            if col in df.columns:
                invalid_count = sum((df[col] <= 0) | (df[col].isnull()))
                if invalid_count > 0:
                    issues.append(
                        QualityIssue(
                            issue_type=DataQualityIssue.INVALID_PRICES,
                            severity=min(
                                1.0,
                                invalid_count / len(df)),
                            description=f"Invalid prices in {col}: {invalid_count}",
                            affected_records=invalid_count,
                            suggested_action=CleaningAction.REMOVE))

        # Check OHLC consistency
        if all(col in df.columns for col in price_columns):
            inconsistent_mask = (
                (df['high'] < df['low']) |
                (df['high'] < df['open']) |
                (df['high'] < df['close']) |
                (df['low'] > df['open']) |
                (df['low'] > df['close']) |
                (df['open'] <= 0) |
                (df['close'] <= 0)
            )
            inconsistent_count = inconsistent_mask.sum()

            if inconsistent_count > 0:
                issues.append(
                    QualityIssue(
                        issue_type=DataQualityIssue.INCONSISTENT_OHLC,
                        severity=min(
                            1.0,
                            inconsistent_count / len(df)),
                        description=f"Inconsistent OHLC data: {inconsistent_count}",
                        affected_records=inconsistent_count,
                        suggested_action=CleaningAction.REMOVE))

        # Check for price outliers
        if 'close' in df.columns:
            outliers = self._detect_outliers(
                df['close'].dropna(), method='iqr')
            if len(outliers) > 0:
                issues.append(QualityIssue(
                    issue_type=DataQualityIssue.PRICE_OUTLIERS,
                    severity=min(1.0, len(outliers) / len(df)),
                    description=f"Price outliers detected: {len(outliers)}",
                    affected_records=len(outliers),
                    suggested_action=CleaningAction.CAP,
                    metadata={'outlier_indices': outliers.tolist()}
                ))

        # Check for volume outliers
        if 'volume' in df.columns:
            volume_data = df['volume'].dropna()
            if len(volume_data) > 0:
                outliers = self._detect_outliers(volume_data, method='iqr')
                if len(outliers) > 0:
                    issues.append(QualityIssue(
                        issue_type=DataQualityIssue.VOLUME_OUTLIERS,
                        # Lower severity for volume
                        severity=min(0.5, len(outliers) / len(df)),
                        description=f"Volume outliers detected: {
                            len(outliers)}",
                        affected_records=len(outliers),
                        suggested_action=CleaningAction.CAP,
                        metadata={'outlier_indices': outliers.tolist()}
                    ))

        # Check for extreme volatility
        if 'close' in df.columns and len(df) > 1:
            returns = df['close'].pct_change().dropna()
            if len(returns) > 10:
                volatility = returns.std()
                z_scores = np.abs(returns / volatility)
                extreme_vol_mask = z_scores > self.volatility_threshold
                extreme_count = extreme_vol_mask.sum()

                if extreme_count > 0:
                    issues.append(
                        QualityIssue(
                            issue_type=DataQualityIssue.EXTREME_VOLATILITY,
                            severity=min(
                                0.8,
                                extreme_count / len(returns)),
                            description=f"Extreme volatility periods: {extreme_count}",
                            affected_records=extreme_count,
                            suggested_action=CleaningAction.FLAG,
                            metadata={
                                'avg_volatility': volatility}))

        # Check for time gaps
        if hasattr(df.index, 'to_series'):
            time_diffs = df.index.to_series().diff()
            large_gaps = time_diffs > timedelta(
                minutes=self.max_time_gap_minutes)
            gap_count = large_gaps.sum()

            if gap_count > 0:
                issues.append(QualityIssue(
                    issue_type=DataQualityIssue.TIME_GAPS,
                    severity=min(0.5, gap_count / len(df)),
                    description=f"Large time gaps: {gap_count}",
                    affected_records=gap_count,
                    suggested_action=CleaningAction.FLAG
                ))

        # Check for duplicates
        if hasattr(df.index, 'duplicated'):
            duplicate_count = df.index.duplicated().sum()
            if duplicate_count > 0:
                issues.append(QualityIssue(
                    issue_type=DataQualityIssue.DUPLICATE_DATA,
                    severity=min(0.7, duplicate_count / len(df)),
                    description=f"Duplicate timestamps: {duplicate_count}",
                    affected_records=duplicate_count,
                    suggested_action=CleaningAction.REMOVE
                ))

        return issues

    def _apply_cleaning_rule(self,
                             df: pd.DataFrame,
                             rule: CleaningRule,
                             issues: List[QualityIssue]) -> Tuple[pd.DataFrame,
                                                                  List[str]]:
        """Apply a specific cleaning rule to the data."""
        actions_taken = []

        try:
            if rule.action == CleaningAction.REMOVE:
                original_len = len(df)

                if rule.issue_type == DataQualityIssue.INVALID_PRICES:
                    # Remove rows with invalid prices
                    price_cols = ['open', 'high', 'low', 'close']
                    for col in price_cols:
                        if col in df.columns:
                            min_price = rule.parameters.get(
                                'min_price', 0.0001)
                            max_price = rule.parameters.get(
                                'max_price', 1000000)
                            df = df[(df[col] >= min_price) &
                                    (df[col] <= max_price)]

                elif rule.issue_type == DataQualityIssue.INCONSISTENT_OHLC:
                    # Remove rows with inconsistent OHLC
                    if all(
                        col in df.columns for col in [
                            'open',
                            'high',
                            'low',
                            'close']):
                        consistent_mask = (
                            (df['high'] >= df['low']) &
                            (df['high'] >= df['open']) &
                            (df['high'] >= df['close']) &
                            (df['low'] <= df['open']) &
                            (df['low'] <= df['close']) &
                            (df['open'] > 0) &
                            (df['close'] > 0)
                        )
                        df = df[consistent_mask]

                elif rule.issue_type == DataQualityIssue.DUPLICATE_DATA:
                    # Remove duplicates
                    keep = rule.parameters.get('keep', 'first')
                    df = df[~df.index.duplicated(keep=keep)]

                removed_count = original_len - len(df)
                if removed_count > 0:
                    actions_taken.append(
                        f"Removed {removed_count} records ({
                            rule.rule_name})")

            elif rule.action == CleaningAction.CAP:
                if rule.issue_type in [
                        DataQualityIssue.PRICE_OUTLIERS,
                        DataQualityIssue.VOLUME_OUTLIERS]:
                    # Cap outliers
                    column = 'close' if rule.issue_type == DataQualityIssue.PRICE_OUTLIERS else 'volume'

                    if column in df.columns:
                        method = rule.parameters.get('method', 'iqr')
                        capped_count = self._cap_outliers(df, column, method)
                        if capped_count > 0:
                            actions_taken.append(
                                f"Capped {capped_count} outliers in {column}")

            elif rule.action == CleaningAction.INTERPOLATE:
                if rule.issue_type == DataQualityIssue.MISSING_VALUES:
                    # Interpolate missing values
                    method = rule.parameters.get('method', 'linear')
                    limit = rule.parameters.get('limit', 5)

                    original_nulls = df.isnull().sum().sum()
                    df = df.interpolate(method=method, limit=limit)
                    remaining_nulls = df.isnull().sum().sum()

                    if original_nulls > remaining_nulls:
                        actions_taken.append(
                            f"Interpolated {
                                original_nulls -
                                remaining_nulls} missing values")

            elif rule.action == CleaningAction.SMOOTH:
                # Smooth extreme values (example implementation)
                if 'close' in df.columns:
                    window = rule.parameters.get('window', 3)
                    df['close'] = df['close'].rolling(
                        window=window, center=True).mean()
                    actions_taken.append(
                        f"Applied smoothing with window {window}")

            elif rule.action == CleaningAction.FLAG:
                # Flag issues without modifying data
                issue_count = sum(
                    issue.affected_records for issue in issues if issue.issue_type == rule.issue_type)
                actions_taken.append(
                    f"Flagged {issue_count} records for {
                        rule.issue_type.value}")

        except Exception as e:
            logger.error(f"Error applying cleaning rule {rule.rule_name}: {e}")
            actions_taken.append(f"Error in {rule.rule_name}: {e}")

        return df, actions_taken

    def _detect_outliers(
            self,
            data: pd.Series,
            method: str = 'iqr') -> np.ndarray:
        """Detect outliers in data series."""
        if len(data) < 4:
            return np.array([])

        if method == 'iqr':
            Q1 = data.quantile(0.25)
            Q3 = data.quantile(0.75)
            IQR = Q3 - Q1

            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR

            outliers = data[(data < lower_bound) | (data > upper_bound)]
            return outliers.index.values

        elif method == 'zscore':
            z_scores = np.abs(stats.zscore(data.dropna()))
            threshold = self.price_outlier_std_threshold
            outlier_indices = np.where(z_scores > threshold)[0]
            return data.index[outlier_indices].values

        elif method == 'modified_zscore':
            median = data.median()
            mad = np.median(np.abs(data - median))

            if mad == 0:
                return np.array([])

            modified_z_scores = 0.6745 * (data - median) / mad
            threshold = 3.5
            outliers = data[np.abs(modified_z_scores) > threshold]
            return outliers.index.values

        return np.array([])

    def _cap_outliers(
            self,
            df: pd.DataFrame,
            column: str,
            method: str = 'iqr') -> int:
        """Cap outliers in specified column."""
        if column not in df.columns:
            return 0

        original_data = df[column].copy()

        if method == 'iqr':
            Q1 = df[column].quantile(0.25)
            Q3 = df[column].quantile(0.75)
            IQR = Q3 - Q1

            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR

            df[column] = df[column].clip(lower=lower_bound, upper=upper_bound)

        elif method == 'percentile':
            lower_percentile = 1
            upper_percentile = 99

            lower_bound = df[column].quantile(lower_percentile / 100)
            upper_bound = df[column].quantile(upper_percentile / 100)

            df[column] = df[column].clip(lower=lower_bound, upper=upper_bound)

        # Count how many values were capped
        capped_count = (df[column] != original_data).sum()
        return capped_count

    def _calculate_quality_score(
            self,
            df: pd.DataFrame,
            issues: List[QualityIssue]) -> float:
        """Calculate overall data quality score."""
        if df.empty:
            return 0.0

        # Base score starts at 1.0
        quality_score = 1.0

        # Deduct points for issues based on severity
        for issue in issues:
            weight = {
                DataQualityIssue.INVALID_PRICES: 0.3,
                DataQualityIssue.INCONSISTENT_OHLC: 0.25,
                DataQualityIssue.MISSING_VALUES: 0.2,
                DataQualityIssue.PRICE_OUTLIERS: 0.1,
                DataQualityIssue.VOLUME_OUTLIERS: 0.05,
                DataQualityIssue.DUPLICATE_DATA: 0.15,
                DataQualityIssue.EXTREME_VOLATILITY: 0.05,
                DataQualityIssue.TIME_GAPS: 0.1,
                DataQualityIssue.LIQUIDITY_ISSUES: 0.1
            }.get(issue.issue_type, 0.1)

            quality_score -= (issue.severity * weight)

        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, quality_score))

    def _final_validation(self, df: pd.DataFrame) -> pd.DataFrame:
        """Final validation and cleanup of data."""
        if df.empty:
            return df

        # Remove any remaining NaN values in critical columns
        critical_columns = ['open', 'high', 'low', 'close']
        for col in critical_columns:
            if col in df.columns:
                df = df.dropna(subset=[col])

        # Ensure volume is non-negative
        if 'volume' in df.columns:
            df['volume'] = df['volume'].clip(lower=0)

        # Sort by timestamp if it's the index
        if hasattr(df.index, 'sort_values'):
            df = df.sort_index()

        return df

    def generate_quality_report(
            self, df: pd.DataFrame, result: CleaningResult) -> Dict[str, Any]:
        """Generate a comprehensive data quality report."""
        report = {
            'summary': {
                'original_records': result.original_count,
                'cleaned_records': result.cleaned_count,
                'records_removed': result.original_count - result.cleaned_count,
                'removal_percentage': (
                    (result.original_count - result.cleaned_count) / result.original_count * 100) if result.original_count > 0 else 0,
                'quality_score': result.quality_score,
                'cleaning_time_ms': result.cleaning_time.total_seconds() * 1000},
            'issues_found': {
                issue.issue_type.value: {
                    'severity': issue.severity,
                    'description': issue.description,
                    'affected_records': issue.affected_records,
                    'suggested_action': issue.suggested_action.value} for issue in result.issues_found},
            'actions_taken': result.actions_taken,
            'data_statistics': {},
            'recommendations': []}

        # Add data statistics if DataFrame is not empty
        if not df.empty:
            stats = {}

            if 'close' in df.columns:
                close_data = df['close'].dropna()
                if len(close_data) > 0:
                    stats['price'] = {
                        'count': len(close_data),
                        'min': float(close_data.min()),
                        'max': float(close_data.max()),
                        'mean': float(close_data.mean()),
                        'std': float(close_data.std()),
                        'missing_pct': (1 - len(close_data) / len(df)) * 100
                    }

            if 'volume' in df.columns:
                volume_data = df['volume'].dropna()
                if len(volume_data) > 0:
                    stats['volume'] = {
                        'count': len(volume_data),
                        'min': float(volume_data.min()),
                        'max': float(volume_data.max()),
                        'mean': float(volume_data.mean()),
                        'total': float(volume_data.sum()),
                        'missing_pct': (1 - len(volume_data) / len(df)) * 100
                    }

            report['data_statistics'] = stats

        # Generate recommendations
        if result.quality_score < 0.7:
            report['recommendations'].append(
                "Data quality is below acceptable threshold. Consider additional cleaning or data source validation.")

        if result.original_count - result.cleaned_count > result.original_count * 0.2:
            report['recommendations'].append(
                "More than 20% of data was removed. Review data source quality.")

        high_severity_issues = [
            issue for issue in result.issues_found if issue.severity > 0.5]
        if high_severity_issues:
            report['recommendations'].append(
                "High severity issues detected. Consider investigating data source.")

        if not report['recommendations']:
            report['recommendations'].append("Data quality is acceptable.")

        return report
