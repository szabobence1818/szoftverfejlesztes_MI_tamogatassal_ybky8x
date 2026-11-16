using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Models;

namespace CarConfigurator.Api.Services;

public class ConfigurationService : IConfigurationService
{
    public static class OptionIds
    {
        public const int BaseEngine = 1;
        public const int SportEngine = 2;

        public const int BaseWhiteColor = 10;
        public const int MetallicColor = 11;
        public const int FireRedColor = 12;

        public const int BaseRim17 = 20;
        public const int Rim18 = 21;
        public const int SportRim19 = 22;

        public const int SportDiffuser = 30;
        public const int TowHook = 31;

        public const int FabricInterior = 40;
        public const int LeatherInterior = 41;

        public const int LargeNavigation = 50;
        public const int PremiumSoundSystem = 51;
        public const int SportSuspension = 52;

        public const int HeatedSeats = 60;
        public const int HeatedSteeringWheel = 61;
        public const int HeatedWindshield = 62;
    }

    private readonly List<CarOption> _options;
    private readonly List<OptionRule> _rules;
    private readonly List<PackageDiscount> _discounts;

    public ConfigurationService()
    {
        _options = SeedDefaultOptions();
        _rules = SeedDefaultRules();
        _discounts = SeedDefaultDiscounts();
    }

    public IReadOnlyList<OptionDto> GetAvailableOptions()
    {
        return _options.Select(o => new OptionDto
        {
            Id = o.Id,
            Code = o.Code,
            Name = o.Name,
            Category = o.Category,
            Price = o.Price,
            LayerImageUrl = o.LayerImageUrl,
            ZIndex = o.ZIndex
        }).ToList();
    }

    public ConfigurationEvaluationResultDto EvaluateConfiguration(ConfigurationRequestDto request)
    {
        var result = new ConfigurationEvaluationResultDto
        {
            IsValid = true
        };

        // 1. Bemeneti adatok strukturális validációja (Elfogadási feltétel #5 váz)
        if (!ValidateInput(request, result))
        {
            result.IsValid = false;
            return result;
        }

        var engineOption = _options.First(o => o.Id == request.EngineOptionId!.Value);
        var selectedOptions = request.SelectedOptionIds
            .Select(id => _options.First(o => o.Id == id))
            .ToList();

        var allSelectedIds = new HashSet<int>(request.SelectedOptionIds) { engineOption.Id };

        // 2. Függőségi szabályok ellenőrzése (Elfogadási feltétel #2 váz)
        CheckDependencies(allSelectedIds, result);

        // 3. Kizárási szabályok ellenőrzése - nem töröl némán opciót! (Elfogadási feltétel #3 váz)
        CheckExclusions(allSelectedIds, result);

        // 4. Alapár és opciók árának számítása (Elfogadási feltétel #1)
        result.BasePrice = engineOption.Price;
        result.OptionsPrice = selectedOptions.Sum(o => o.Price);

        // 5. Csomagkedvezmények kalkulációja (Elfogadási feltétel #4 váz)
        result.DiscountAmount = CalculateDiscounts(allSelectedIds, selectedOptions, result);

        result.TotalPrice = result.BasePrice + result.OptionsPrice - result.DiscountAmount;
        result.IsValid = result.Errors.Count == 0;

        // 6. 2D vizuális rétegek összeállítása z-index szerint rendezve (Elfogadási feltétel #7 váz)
        result.VisualLayers = BuildVisualLayers(selectedOptions);

        return result;
    }

    protected virtual bool ValidateInput(ConfigurationRequestDto request, ConfigurationEvaluationResultDto result)
    {
        if (request == null || !request.EngineOptionId.HasValue)
        {
            result.Errors.Add(new ValidationIssueDto
            {
                Code = "MISSING_ENGINE",
                Message = "A motor kiválasztása kötelező."
            });
            return false;
        }

        var engineOption = _options.FirstOrDefault(o => o.Id == request.EngineOptionId.Value && o.Category == OptionCategory.Engine);
        if (engineOption == null)
        {
            result.Errors.Add(new ValidationIssueDto
            {
                Code = "INVALID_ENGINE_ID",
                Message = $"Érvénytelen motor azonosító: {request.EngineOptionId.Value}.",
                AffectedOptionIds = new List<int> { request.EngineOptionId.Value }
            });
            return false;
        }

        var selectedIds = request.SelectedOptionIds ?? new List<int>();
        if (selectedIds.Distinct().Count() != selectedIds.Count)
        {
            result.Errors.Add(new ValidationIssueDto
            {
                Code = "DUPLICATE_OPTIONS",
                Message = "A kiválasztott opciók között duplikáció található."
            });
            return false;
        }

        foreach (var id in selectedIds)
        {
            if (!_options.Any(o => o.Id == id && o.Category != OptionCategory.Engine))
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = "INVALID_OPTION_ID",
                    Message = $"Nem létező vagy érvénytelen opció azonosító: {id}.",
                    AffectedOptionIds = new List<int> { id }
                });
                return false;
            }
        }

        return true;
    }

    protected virtual void CheckDependencies(HashSet<int> allSelectedIds, ConfigurationEvaluationResultDto result)
    {
        foreach (var rule in _rules.Where(r => r.RuleType == RuleType.Requires))
        {
            if (allSelectedIds.Contains(rule.SourceOptionId) && !allSelectedIds.Contains(rule.TargetOptionId))
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = "DEPENDENCY_MISSING",
                    Message = rule.ErrorMessage,
                    AffectedOptionIds = new List<int> { rule.SourceOptionId, rule.TargetOptionId }
                });
            }
        }
    }

    protected virtual void CheckExclusions(HashSet<int> allSelectedIds, ConfigurationEvaluationResultDto result)
    {
        foreach (var rule in _rules.Where(r => r.RuleType == RuleType.Excludes))
        {
            if (allSelectedIds.Contains(rule.SourceOptionId) && allSelectedIds.Contains(rule.TargetOptionId))
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = "EXCLUSION_CONFLICT",
                    Message = rule.ErrorMessage,
                    AffectedOptionIds = new List<int> { rule.SourceOptionId, rule.TargetOptionId }
                });
            }
        }
    }

    protected virtual decimal CalculateDiscounts(
        HashSet<int> allSelectedIds,
        List<CarOption> selectedOptions,
        ConfigurationEvaluationResultDto result)
    {
        decimal totalDiscount = 0m;

        foreach (var discount in _discounts)
        {
            if (discount.RequiredOptionIds.All(id => allSelectedIds.Contains(id)))
            {
                var packageSum = selectedOptions
                    .Where(o => discount.RequiredOptionIds.Contains(o.Id))
                    .Sum(o => o.Price);

                var discountValue = Math.Round(packageSum * discount.DiscountPercentage, 0);
                totalDiscount += discountValue;
                result.AppliedDiscounts.Add(discount.Name);
            }
        }

        return totalDiscount;
    }

    protected virtual List<LayerPreviewDto> BuildVisualLayers(List<CarOption> selectedOptions)
    {
        return selectedOptions
            .Where(o => !string.IsNullOrWhiteSpace(o.LayerImageUrl) && o.ZIndex.HasValue)
            .OrderBy(o => o.ZIndex!.Value)
            .Select(o => new LayerPreviewDto
            {
                OptionId = o.Id,
                OptionName = o.Name,
                Category = o.Category,
                LayerImageUrl = o.LayerImageUrl!,
                ZIndex = o.ZIndex!.Value
            })
            .ToList();
    }

    private static List<CarOption> SeedDefaultOptions() => new()
    {
        new CarOption { Id = OptionIds.BaseEngine, Code = "ENGINE_BASE", Name = "Alap motor", Category = OptionCategory.Engine, Price = 10_000_000m },
        new CarOption { Id = OptionIds.SportEngine, Code = "ENGINE_SPORT", Name = "Sport motor", Category = OptionCategory.Engine, Price = 13_500_000m },

        new CarOption { Id = OptionIds.BaseWhiteColor, Code = "COLOR_WHITE", Name = "Alap fehér", Category = OptionCategory.ExteriorColor, Price = 0m, LayerImageUrl = "/layers/color-white.svg", ZIndex = 10 },
        new CarOption { Id = OptionIds.MetallicColor, Code = "COLOR_METALLIC", Name = "Metál szín", Category = OptionCategory.ExteriorColor, Price = 250_000m, LayerImageUrl = "/layers/color-metallic.svg", ZIndex = 10 },
        new CarOption { Id = OptionIds.FireRedColor, Code = "COLOR_FIRERED", Name = "Tűzpiros", Category = OptionCategory.ExteriorColor, Price = 300_000m, LayerImageUrl = "/layers/color-firered.svg", ZIndex = 10 },

        new CarOption { Id = OptionIds.BaseRim17, Code = "RIM_17", Name = "17\" Alap felni", Category = OptionCategory.Rim, Price = 0m, LayerImageUrl = "/layers/rim-17.svg", ZIndex = 30 },
        new CarOption { Id = OptionIds.Rim18, Code = "RIM_18", Name = "18\" felni", Category = OptionCategory.Rim, Price = 350_000m, LayerImageUrl = "/layers/rim-18.svg", ZIndex = 30 },
        new CarOption { Id = OptionIds.SportRim19, Code = "RIM_19_SPORT", Name = "19\" Sport", Category = OptionCategory.Rim, Price = 550_000m, LayerImageUrl = "/layers/rim-19-sport.svg", ZIndex = 30 },

        new CarOption { Id = OptionIds.SportDiffuser, Code = "OPT_DIFFUSER", Name = "Sport diffúzor", Category = OptionCategory.ExteriorOptical, Price = 200_000m, LayerImageUrl = "/layers/opt-diffuser.svg", ZIndex = 20 },
        new CarOption { Id = OptionIds.TowHook, Code = "OPT_TOWHOOK", Name = "Vonóhorog", Category = OptionCategory.ExteriorOptical, Price = 250_000m, LayerImageUrl = "/layers/opt-towhook.svg", ZIndex = 25 },

        new CarOption { Id = OptionIds.FabricInterior, Code = "INT_FABRIC", Name = "Szövet kárpit", Category = OptionCategory.Interior, Price = 0m },
        new CarOption { Id = OptionIds.LeatherInterior, Code = "INT_LEATHER", Name = "Bőr kárpit", Category = OptionCategory.Interior, Price = 450_000m },

        new CarOption { Id = OptionIds.LargeNavigation, Code = "EXT_NAVI_LARGE", Name = "Nagy navigáció", Category = OptionCategory.Extra, Price = 300_000m },
        new CarOption { Id = OptionIds.PremiumSoundSystem, Code = "EXT_SOUND_PREMIUM", Name = "Prémium hangrendszer", Category = OptionCategory.Extra, Price = 400_000m },
        new CarOption { Id = OptionIds.SportSuspension, Code = "EXT_SUSP_SPORT", Name = "Sportfutómű", Category = OptionCategory.Extra, Price = 350_000m },

        new CarOption { Id = OptionIds.HeatedSeats, Code = "EXT_WINTER_SEATS", Name = "Ülésfűtés", Category = OptionCategory.Extra, Price = 150_000m },
        new CarOption { Id = OptionIds.HeatedSteeringWheel, Code = "EXT_WINTER_WHEEL", Name = "Kormányfűtés", Category = OptionCategory.Extra, Price = 100_000m },
        new CarOption { Id = OptionIds.HeatedWindshield, Code = "EXT_WINTER_WINDSHIELD", Name = "Fűthető szélvédő", Category = OptionCategory.Extra, Price = 150_000m }
    };

    private static List<OptionRule> SeedDefaultRules() => new()
    {
        new OptionRule
        {
            Id = 1,
            RuleType = RuleType.Requires,
            SourceOptionId = OptionIds.PremiumSoundSystem,
            TargetOptionId = OptionIds.LargeNavigation,
            ErrorMessage = "A „Prémium hangrendszer” választásához kötelező a „Nagy navigáció” kiválasztása."
        },
        new OptionRule
        {
            Id = 2,
            RuleType = RuleType.Excludes,
            SourceOptionId = OptionIds.BaseEngine,
            TargetOptionId = OptionIds.SportSuspension,
            ErrorMessage = "Az „Alap motor” és a „Sportfutómű” kizárják egymást."
        },
        new OptionRule
        {
            Id = 3,
            RuleType = RuleType.Excludes,
            SourceOptionId = OptionIds.SportDiffuser,
            TargetOptionId = OptionIds.TowHook,
            ErrorMessage = "A „Sport diffúzor” és a „Vonóhorog” nem választható együtt."
        }
    };

    private static List<PackageDiscount> SeedDefaultDiscounts() => new()
    {
        new PackageDiscount
        {
            Id = 1,
            Name = "Téli csomag",
            RequiredOptionIds = new List<int>
            {
                OptionIds.HeatedSeats,
                OptionIds.HeatedSteeringWheel,
                OptionIds.HeatedWindshield
            },
            DiscountPercentage = 0.20m
        }
    };
}
