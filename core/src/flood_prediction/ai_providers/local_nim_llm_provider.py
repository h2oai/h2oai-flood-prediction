import asyncio
import time
from typing import Callable, List, Optional

from bs4 import BeautifulSoup
from openai import OpenAI

from ..settings import settings
from .base import AIProvider


class LocalNIMLLMProvider(AIProvider):
    """Local NVIDIA NIM LLM Provider implementation for Helm-deployed NIM models

    This provider connects to a locally deployed NVIDIA NIM model within the same
    Kubernetes cluster. The NIM model is deployed as a dependency via Helm and is
    accessible at: http://flood-prediction-nim-llm:8000/v1
    """

    def __init__(self):
        # API key is optional for local deployment, but can be configured if needed
        api_key = settings.local_nim_api_key or "not-used"

        self._client = OpenAI(base_url=settings.local_nim_base_url, api_key=api_key)
        self._available_models = None
        self._default_model = settings.local_nim_default_model
        self._provider_name = "nim-llm"
        self._supports_agents = False

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def default_model(self) -> str:
        return self._default_model

    @property
    def supports_agents(self) -> bool:
        return self._supports_agents

    def get_available_models(self) -> List[str]:
        """Get list of available models from local NVIDIA NIM"""
        if self._available_models is not None:
            return self._available_models

        try:
            models_response = self._client.models.list()
            self._available_models = [model.id for model in models_response.data]
            return self._available_models
        except Exception as e:
            print(f"Error fetching local NIM models: {e}")
            # Return the deployed model as fallback
            self._available_models = [self._default_model]
            return self._available_models

    async def chat_completion(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 32768,
        **kwargs,
    ) -> str:
        """
        Generate a chat completion response using local NVIDIA NIM

        Args:
            prompt: The input prompt/message
            model: Model name to use (optional)
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters (top_p, top_k, etc.)

        Returns:
            Generated response text
        """
        # Run the OpenAI client call in a thread pool to make it async
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._sync_chat_completion,
            prompt,
            model,
            temperature,
            max_tokens,
            kwargs,
        )

    def _sync_chat_completion(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 32768,
        extra_kwargs: dict = None,
    ) -> str:
        """Synchronous chat completion helper"""
        try:
            # Prepare messages
            completion = self._client.chat.completions.create(
                model=model or self._default_model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=temperature,
                top_p=0.95,
                max_tokens=max_tokens,
                stream=False,
            )
            content = completion.choices[0].message.content or ""
            return content
        except Exception as e:
            raise RuntimeError(f"Local NIM API error: {str(e)}")

    async def stream_completion(
        self,
        prompt: str,
        callback: Callable[[str], None],
        model: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 32768,
        **kwargs,
    ) -> str:
        """
        Generate a streaming chat completion response using local NVIDIA NIM

        Args:
            prompt: The input prompt/message
            callback: Function called with each streaming chunk
            model: Model name to use (optional)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters

        Returns:
            Final complete response text
        """
        # Run the streaming call in a thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._sync_stream_completion,
            prompt,
            callback,
            model,
            temperature,
            max_tokens,
            kwargs,
        )

    def _sync_stream_completion(
        self,
        prompt: str,
        callback: Callable[[str], None],
        model: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 32768,
        extra_kwargs: dict = None,
    ) -> str:
        """Synchronous streaming completion helper"""
        try:
            response = self._client.chat.completions.create(
                model=model or self._default_model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=temperature,
                top_p=0.95,
                max_tokens=max_tokens,
                stream=True,
            )

            full_response = ""
            found_think_start = False
            found_think_end = False
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content

                    if found_think_start and not found_think_end:
                        full_response = full_response.replace("</think>", "")

                    full_response += content

                    if not found_think_start:
                        if "<think>" in full_response:
                            found_think_start = True

                    if found_think_start and not found_think_end:
                        if "</think>" in full_response:
                            found_think_end = True
                        else:
                            full_response += "</think>"

                    callback(full_response)  # Send accumulated response
                # Check if stream is done
                if chunk.choices[0].finish_reason is not None:
                    break
            return full_response
        except Exception as e:
            raise RuntimeError(f"NVIDIA streaming API error: {str(e)}")

    def get_model_info(self, model_name: Optional[str] = None) -> dict:
        """Get information about a specific model"""
        model_name = model_name or self.default_model
        try:
            model_info = self._client.models.retrieve(model_name)
            return {
                "id": model_info.id,
                "object": model_info.object,
                "created": getattr(model_info, "created", None),
                "owned_by": getattr(model_info, "owned_by", "nvidia"),
            }
        except Exception as e:
            return {
                "id": model_name,
                "object": "model",
                "owned_by": "nvidia",
                "error": str(e),
            }

    def get_provider_info(self) -> dict:
        """Get enhanced provider information"""
        base_info = super().get_provider_info()
        base_info.update(
            {
                "base_url": settings.local_nim_base_url,
                "deployment_type": "kubernetes-helm",
                "service_name": "flood-prediction-nim-llm",
                "service_port": 8000,
                "supports_embeddings": False,  # Configure based on your deployment
                "supports_reranking": False,  # Configure based on your deployment
                "description": "Local NVIDIA NIM LLM deployed via Helm in Kubernetes cluster",
            }
        )
        return base_info
