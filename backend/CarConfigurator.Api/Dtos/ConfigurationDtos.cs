using CarConfigurator.Api.Models;

namespace CarConfigurator.Api.Dtos;

public class OptionDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public OptionCategory Category { get; set; }
    public decimal Price { get; set; }
    public string? LayerImageUrl { get; set; }
    public int? ZIndex { get; set; }
}

public class ConfigurationRequestDto
{
    public int? EngineOptionId { get; set; }
    public List<int> SelectedOptionIds { get; set; } = new();
}

public class ValidationIssueDto
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public List<int> AffectedOptionIds { get; set; } = new();
}

public class LayerPreviewDto
{
    public int OptionId { get; set; }
    public string OptionName { get; set; } = string.Empty;
    public OptionCategory Category { get; set; }
    public string LayerImageUrl { get; set; } = string.Empty;
    public int ZIndex { get; set; }
}

public class ConfigurationEvaluationResultDto
{
    public bool IsValid { get; set; }
    public bool HasInvalidInput { get; set; }
    public bool CanSave { get; set; }
    public int? EngineOptionId { get; set; }
    public List<int> SelectedOptionIds { get; set; } = new();
    public decimal BasePrice { get; set; }
    public decimal OptionsPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalPrice { get; set; }
    public List<string> AppliedDiscounts { get; set; } = new();
    public List<ValidationIssueDto> Errors { get; set; } = new();
    public List<LayerPreviewDto> VisualLayers { get; set; } = new();
}

public class SaveConfigurationRequestDto
{
    public string Name { get; set; } = string.Empty;
    public int? EngineOptionId { get; set; }
    public List<int> SelectedOptionIds { get; set; } = new();
}

public class SavedConfigurationDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public int EngineOptionId { get; set; }
    public List<int> SelectedOptionIds { get; set; } = new();
    public decimal SavedTotalPrice { get; set; }
    public ConfigurationEvaluationResultDto? CurrentEvaluation { get; set; }
}
