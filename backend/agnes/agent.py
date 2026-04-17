from google.adk.agents import LlmAgent
from google.adk.models import Gemini


# Simple tool to try
def get_weather(location: str) -> str:
    return f"Location: {location}. Weather: sunny, 76 degrees Fahrenheit, 8 mph wind."


root_agent = LlmAgent(
    model=Gemini(model="gemma-4-31b-it"),
    name="weather_agent",
    instruction="You are a helpful assistant that can provide current weather.",
    tools=[get_weather],
)
