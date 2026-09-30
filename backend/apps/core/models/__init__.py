from importlib import import_module


_MODEL_MODULES = {
    'MenuGroup': '.menuGroup',
    'MenuModule': '.menuModule',
    'ModulePermission': '.modulePermission',
    'Organization': '.organization',
}

__all__ = list(_MODEL_MODULES.keys())


def __getattr__(name):
    module_name = _MODEL_MODULES.get(name)
    if not module_name:
        raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

    module = import_module(module_name, __name__)
    return getattr(module, name)
