from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    model_cache_dir: Path = Field(
        default=Path("/data/models/solux"),
        validation_alias="MODEL_CACHE_DIR",
    )
    solux_output_dir: Path = Field(
        default=Path("/data/models/solux/outputs"),
        validation_alias="SOLUX_OUTPUT_DIR",
    )
    registry_json: Path = Field(
        default=Path("ops/model-cache/model-registry.json"),
        validation_alias="REGISTRY_JSON",
    )
    hf_token: str | None = Field(default=None, validation_alias="HF_TOKEN")
    model_gpu: int | None = Field(default=None, validation_alias="MODEL_GPU")
    cuda_visible_devices: str | None = Field(
        default=None,
        validation_alias="CUDA_VISIBLE_DEVICES",
    )
    solux_max_loaded_models: int = Field(
        default=2,
        validation_alias="SOLUX_MAX_LOADED_MODELS",
    )
    max_models_per_gpu: int = Field(
        default=1,
        validation_alias="MAX_MODELS_PER_GPU",
    )
    gpu_count: int = Field(default=2, validation_alias="GPU_COUNT")
    dual_gpu_parallel: bool = Field(default=True, validation_alias="DUAL_GPU_PARALLEL")
    keep_models_warm_after_job: bool = Field(
        default=False,
        validation_alias="KEEP_MODELS_WARM_AFTER_JOB",
    )
    preload_gpu1_model: str | None = Field(
        default="clay",
        validation_alias="PRELOAD_GPU1_MODEL",
    )
    preload_required_models: bool = Field(
        default=False,
        validation_alias="PRELOAD_REQUIRED_MODELS",
    )
    auto_unload_after_seconds: int = Field(
        default=600,
        validation_alias="AUTO_UNLOAD_AFTER_SECONDS",
    )
    local_critic_model_id: str = Field(
        default="Qwen/Qwen2.5-7B-Instruct",
        validation_alias="LOCAL_CRITIC_MODEL_ID",
    )
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=8088, validation_alias="PORT")
    log_level: str = Field(default="info", validation_alias="LOG_LEVEL")
    solux_data_dir: Path = Field(
        default=Path("data"),
        validation_alias="SOLUX_DATA_DIR",
    )
    max_critic_base_url: str = Field(
        default="http://127.0.0.1:8010",
        validation_alias="MAX_CRITIC_BASE_URL",
    )
    max_critic_timeout_seconds: float = Field(
        default=60.0,
        validation_alias="MAX_CRITIC_TIMEOUT_SECONDS",
    )
    default_latency_mode: str = Field(
        default="fast",
        validation_alias="DEFAULT_LATENCY_MODE",
    )
    mojo_kernels_enabled: bool = Field(default=True, validation_alias="MOJO_KERNELS_ENABLED")
    mojo_kernels_dir: Path = Field(
        default=Path("modular/kernels"),
        validation_alias="MOJO_KERNELS_DIR",
    )

    @field_validator("mojo_kernels_dir", mode="before")
    @classmethod
    def _resolve_mojo_kernels_dir(cls, value: object) -> object:
        if value is None or value == "":
            return Path("modular/kernels")
        p = Path(str(value))
        if not p.is_absolute():
            root = Path(__file__).resolve().parents[1]
            return (root / p).resolve()
        return p.resolve()

    @field_validator("model_gpu", "preload_gpu1_model", mode="before")
    @classmethod
    def _empty_str_to_none(cls, value: object) -> object:
        if value == "" or value is None:
            return None
        return value

    @property
    def registry_path(self) -> Path:
        path = self.registry_json
        if not path.is_absolute():
            root = Path(__file__).resolve().parents[1]
            return (root / path).resolve()
        return path.resolve()

    @property
    def default_solar_gpu(self) -> int:
        return self.model_gpu if self.model_gpu is not None else 0

    @property
    def default_foundation_gpu(self) -> int:
        if self.model_gpu is not None:
            return self.model_gpu
        return 1


    @property
    def data_dir(self) -> Path:
        p = self.solux_data_dir
        if not p.is_absolute():
            root = Path(__file__).resolve().parents[1]
            return (root / p).resolve()
        return p.resolve()

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def learning_dir(self) -> Path:
        return self.data_dir / "learning"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    try:
        settings.solux_output_dir.mkdir(parents=True, exist_ok=True)
        settings.data_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    return settings
