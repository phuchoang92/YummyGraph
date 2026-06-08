import pytest

YummyGraphDockerEnvironment = pytest.importorskip(
    "environments.yummygraph_docker"
).YummyGraphDockerEnvironment
tool_registry = pytest.importorskip("tool_registry")
TOOL_SPECS = tool_registry.TOOL_SPECS


def test_render_query_script_uses_endpoint_and_fallback():
    script = YummyGraphDockerEnvironment._render_tool_script(TOOL_SPECS["query"], "4848")
    assert "/tool/query" in script
    assert "yummygraph query" in script
    assert "YUMMYGRAPH_EVAL_PORT" in script


def test_render_augment_script_skips_curl():
    script = YummyGraphDockerEnvironment._render_tool_script(TOOL_SPECS["augment"], "4848")
    assert "/tool/" not in script
    assert "curl" not in script
    assert "yummygraph augment" in script
