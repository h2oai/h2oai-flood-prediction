from typing import Dict, Type
from .base import AIProvider
from .h2ogpte_provider import H2OGPTEProvider
from .nvidia_provider import NVIDIAProvider
from ..settings import settings


# Registry of available providers
PROVIDER_REGISTRY: Dict[str, Type[AIProvider]] = {
    "h2ogpte": H2OGPTEProvider,
    "nvidia": NVIDIAProvider,
}


def get_ai_provider(provider_name: str = None) -> AIProvider:
    """
    Get AI provider instance based on configuration
    
    Args:
        provider_name: Override provider name (optional)
        
    Returns:
        AIProvider instance
        
    Raises:
        ValueError: If provider is not supported or not configured
    """
    provider_name = provider_name or settings.ai_provider
    
    if provider_name not in PROVIDER_REGISTRY:
        available_providers = list(PROVIDER_REGISTRY.keys())
        raise ValueError(
            f"Provider '{provider_name}' is not supported. "
            f"Available providers: {available_providers}"
        )
    
    # Validate provider configuration
    if provider_name == "h2ogpte":
        if not settings.h2ogpte_url or not settings.h2ogpte_api_key:
            raise ValueError(
                "H2OGPTE provider requires h2ogpte_url and h2ogpte_api_key to be set"
            )
    elif provider_name == "nvidia":
        if not settings.nvidia_api_key:
            raise ValueError(
                "NVIDIA provider requires nvidia_api_key to be set"
            )
    
    # Create and return provider instance
    provider_class = PROVIDER_REGISTRY[provider_name]
    return provider_class()


def get_available_providers() -> Dict[str, Dict]:
    """
    Get information about all available providers
    
    Returns:
        Dictionary with provider information
    """
    providers_info = {}
    
    for provider_name, provider_class in PROVIDER_REGISTRY.items():
        try:
            # Try to create instance to check if properly configured
            provider = provider_class()
            providers_info[provider_name] = {
                "available": True,
                "info": provider.get_provider_info(),
                "error": None
            }
        except Exception as e:
            providers_info[provider_name] = {
                "available": False,
                "info": {"name": provider_name},
                "error": str(e)
            }
    
    return providers_info


def register_provider(name: str, provider_class: Type[AIProvider]):
    """
    Register a new AI provider
    
    Args:
        name: Provider name
        provider_class: Provider class that implements AIProvider interface
    """
    if not issubclass(provider_class, AIProvider):
        raise ValueError(f"Provider class must inherit from AIProvider")
    
    PROVIDER_REGISTRY[name] = provider_class


def get_provider_for_capability(capability: str) -> AIProvider:
    """
    Get the best provider for a specific capability
    
    Args:
        capability: Required capability (e.g., "agents", "embeddings", "streaming")
        
    Returns:
        Best AIProvider instance for the capability
    """
    # Priority order for different capabilities
    capability_priorities = {
        "agents": ["h2ogpte", "nvidia"],  # H2OGPTE supports agents better
        "embeddings": ["nvidia", "h2ogpte"],  # NVIDIA has better embedding models
        "streaming": ["nvidia", "h2ogpte"],  # Both support streaming
        "default": [settings.ai_provider, "h2ogpte", "nvidia"]  # Use configured default first
    }
    
    priorities = capability_priorities.get(capability, capability_priorities["default"])
    
    for provider_name in priorities:
        try:
            provider = get_ai_provider(provider_name)
            
            # Check if provider supports the capability
            if capability == "agents" and not getattr(provider, 'supports_agents', False):
                continue
            
            return provider
        except Exception:
            continue
    
    # Fallback to default provider
    return get_ai_provider()