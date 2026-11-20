namespace CarConfigurator.Api.Models;

public enum RuleType
{
    Requires = 1,
    Excludes = 2
}

public class OptionRule
{
    public int Id { get; set; }
    public RuleType RuleType { get; set; }
    public int SourceOptionId { get; set; }
    public int TargetOptionId { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;
}
