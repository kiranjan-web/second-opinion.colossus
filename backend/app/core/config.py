from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Second Voice API"
    VERSION: str = "3.0.0-Colossus"
    GEMINI_API_KEY: str = ""
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    MAX_WS_CONNECTIONS: int = 5

    class Config:
        env_file = ".env"

settings = Settings()