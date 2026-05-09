"""Session-local variant shadow state for VTS toggle hotkeys."""

from __future__ import annotations

from loguru import logger

from contracts import VariantToggle

from .discrete_dispatcher import DiscreteDispatcher


class VariantStateManager:
    def __init__(
        self,
        dispatcher: DiscreteDispatcher,
        reset_hotkey_id: str | None = None,
        reset_hotkey_name: str = "RemoveAllExpressions",
    ) -> None:
        self._dispatcher = dispatcher
        self._reset_hotkey_id = reset_hotkey_id
        self._reset_hotkey_name = reset_hotkey_name
        self._current_hotkey_id: str | None = None

    @property
    def current_hotkey_id(self) -> str | None:
        return self._current_hotkey_id

    async def reset_to_baseline(self) -> None:
        if self._reset_hotkey_id is not None:
            await self._dispatcher.fire(
                self._reset_hotkey_id,
                name=self._reset_hotkey_name,
                force=True,
            )
        self._current_hotkey_id = None

    async def apply(self, toggle: VariantToggle) -> None:
        if toggle.hotkey_id == self._current_hotkey_id:
            logger.debug(
                "[VARIANT-MGR] re-emit no-op hotkey_id={!r} name={!r}",
                toggle.hotkey_id,
                toggle.name,
            )
            return

        if self._current_hotkey_id is not None:
            await self._dispatcher.fire(self._current_hotkey_id)

        await self._dispatcher.fire(toggle.hotkey_id, name=toggle.name)
        self._current_hotkey_id = toggle.hotkey_id
